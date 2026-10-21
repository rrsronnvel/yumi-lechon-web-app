using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public interface IAiIntakeParserService
{
    Task<ParsedOrderDraftDto> ParseScreenshotAsync(IFormFile file);
}

public class AiIntakeParserService : IAiIntakeParserService
{
    private readonly LechonDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AiIntakeParserService> _logger;

    public AiIntakeParserService(
        LechonDbContext context,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<AiIntakeParserService> logger)
    {
        _context = context;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<ParsedOrderDraftDto> ParseScreenshotAsync(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("No screenshot file was provided.");
        }

        var mimeType = file.ContentType;
        if (string.IsNullOrWhiteSpace(mimeType) || !mimeType.StartsWith("image/"))
        {
            mimeType = "image/jpeg";
        }

        // 1. Read image bytes and convert to base64
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var imageBytes = memoryStream.ToArray();
        var base64Data = Convert.ToBase64String(imageBytes);

        _logger.LogInformation(
            "Processing screenshot intake. File: '{FileName}', Size: {SizeKb:F1} KB, ContentType: '{MimeType}'",
            file.FileName, imageBytes.Length / 1024.0, mimeType);

        // 2. Query active item categories from DB
        var activeCategories = await _context.ItemCategories
            .Where(c => c.IsActive)
            .AsNoTracking()
            .ToListAsync();

        // 3. Retrieve API key
        var apiKey = _configuration["Gemini:ApiKey"]
            ?? _configuration["GoogleCloud:ApiKey"]
            ?? _configuration["GEMINI_API_KEY"]
            ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Equals("MOCK", StringComparison.OrdinalIgnoreCase))
        {
            var enableMock = _configuration.GetValue<bool>("Gemini:EnableMockFallback", false)
                             || apiKey?.Equals("MOCK", StringComparison.OrdinalIgnoreCase) == true;

            if (enableMock)
            {
                _logger.LogInformation("Gemini API key is not configured or set to MOCK. Using Mock fallback order parser.");
                return GenerateMockOrderDraft(activeCategories);
            }

            throw new InvalidOperationException("Gemini API key is not configured. Please set 'Gemini:ApiKey' or 'GoogleCloud:ApiKey' in configuration (appsettings.json) or 'GEMINI_API_KEY' environment variable.");
        }

        // 4. Construct System Instruction with dynamic categories and strict separation rules
        var promptBuilder = new StringBuilder();
        promptBuilder.AppendLine("You are an expert order intake specialist for Yumi Lechon in Cavite, Philippines.");
        promptBuilder.AppendLine("Your job is to parse incoming Facebook Messenger / chat screenshots of customer booking slips into a high-precision structured order draft.");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("CURRENT ACTIVE MENU CATEGORIES IN DATABASE:");
        foreach (var cat in activeCategories)
        {
            promptBuilder.AppendLine($"- Category ID: {cat.Id} | Name: \"{cat.Name}\" | Weight Range: {cat.MinimumWeightKg:F1}kg - {cat.MaximumWeightKg:F1}kg | Base Price: ₱{cat.BasePrice:N2}");
        }
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("CRITICAL EXTRACTION & FIELD SEPARATION RULES:");
        promptBuilder.AppendLine("1. Human-in-the-Loop Safety: Extract ONLY visibly confirmed booking data directly from the image. Do NOT invent, assume, or hallucinate missing dates, phone numbers, addresses, or items. If a value is missing or unclear, leave it null or empty.");
        promptBuilder.AppendLine("2. Header vs. Body Identity Separation:");
        promptBuilder.AppendLine("   - 'facebookName' (Header Extraction): Extract the profile name shown at the top Messenger navigation bar/header (e.g., \"Macel Obina Mendoza\"). If not visible, return null or \"\".");
        promptBuilder.AppendLine("   - 'customerName' (Body Extraction): Extract the recipient name labeled inside the booking form text (e.g., \"Name : Macel Mendoza\" -> \"Macel Mendoza\").");
        promptBuilder.AppendLine("3. Dedicated Metadata Isolation (NEVER dump into 'remarks'):");
        promptBuilder.AppendLine("   - 'landmark' (Dedicated Landmark): Extract any text labeled \"Landmark :\" or drop-off guide (e.g., \"Paseo de carmona\") directly into 'landmark'. NEVER put landmarks inside 'remarks'.");
        promptBuilder.AppendLine("   - 'eventType' (Dedicated Event Type): Extract any text labeled \"Type of Event :\" or \"Event :\" (e.g., \"Anniversary\", \"Birthday\", \"Binyag\", \"Fiesta\", \"Wedding\", \"Corporate\") directly into 'eventType'. NEVER put event types inside 'remarks'.");
        promptBuilder.AppendLine("4. Strict Kitchen Sanitation for 'remarks':");
        promptBuilder.AppendLine("   - 'remarks' is strictly reserved for kitchen preparation, roasting, or packaging instructions (e.g., \"walang dinuguan\", \"print shoutout banner\", \"extra crispy skin\", \"liver sauce only\") plus any secondary contact number (CP # 2).");
        promptBuilder.AppendLine("   - NEVER include landmarks, event types, addresses, or delivery charges in 'remarks'.");
        promptBuilder.AppendLine("   - If the screenshot contains no kitchen-specific prep request or secondary phone number, 'remarks' MUST be an empty string \"\".");
        promptBuilder.AppendLine("5. Menu Disambiguation:");
        promptBuilder.AppendLine("   - Match word-based sizes (\"XXS\", \"XS\", \"S\", \"Small\", \"M\", \"Medium\", \"L\", \"Large\", \"XL\", \"XXL\", \"Jumbo\", \"S. Jumbo\") strictly to Whole Lechon categories.");
        promptBuilder.AppendLine("   - Match kilogram weights (\"Belly 2kg\", \"Belly 3kg\", \"Belly 4kg\", \"Belly 5kg\", \"4kg Belly\", etc.) strictly to Lechon Belly categories.");
        promptBuilder.AppendLine("   - Match mentioned add-ons (e.g., \"Sarsa\", \"Extra Dinuguan\", \"Pancit\", \"Palabok\", \"Spaghetti\", \"Puto\", \"1.5 L coke\") to matching add-on category IDs from the active categories list above. If no exact category exists in the active menu list for a requested culinary note, append only that kitchen instruction to 'remarks'.");
        promptBuilder.AppendLine("   - For each item in 'items', 'itemCategoryId' MUST be a valid Category ID from the active menu categories list above, and 'quantity' must be an integer >= 1.");
        promptBuilder.AppendLine("6. Contact & Fulfillment Rules:");
        promptBuilder.AppendLine("   - Primary phone (CP # 1 / Cellphone / Mobile) maps to 'contactNumber'.");
        promptBuilder.AppendLine("   - If 'Pickup' / 'Pick up' / 'Store pickup' is indicated: set 'fulfillment' = 0 and 'deliveryFee' = 0, and leave 'deliveryAddress' null or empty.");
        promptBuilder.AppendLine("   - If 'Lalamove' is indicated: set 'fulfillment' = 2 and 'deliveryFee' = 0, and extract 'deliveryAddress'.");
        promptBuilder.AppendLine("   - If 'Delivery' is indicated: set 'fulfillment' = 1, extract 'deliveryAddress', and extract 'deliveryFee' from explicitly stated delivery charges (e.g., \"Deliver Charge : 0\" -> 0, \"Delivery Charge : 565\" -> 565).");
        promptBuilder.AppendLine("7. Downpayment & Target Time:");
        promptBuilder.AppendLine("   - Extract paid deposits or downpayments (e.g., 'DP : 11,000 (paid)', 'DP: 3,000', 'Downpayment: ₱5,000', 'Deposit: 2000') into 'downpayment' as a numeric amount. If only total price is shown without payment confirmation, downpayment should be null or 0.");
        promptBuilder.AppendLine("   - If target date/time is specified, convert to ISO 8601 string (e.g. '2026-10-25T12:00:00'). If year is not mentioned, infer the current year (2026). If time/date is not present, set to null.");

        var systemInstructionText = promptBuilder.ToString();

        // 5. Build structured JSON request payload for Gemini API
        var requestPayload = new
        {
            systemInstruction = new
            {
                parts = new object[]
                {
                    new { text = systemInstructionText }
                }
            },
            contents = new object[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new
                        {
                            inlineData = new
                            {
                                mimeType = mimeType,
                                data = base64Data
                            }
                        },
                        new
                        {
                            text = "Extract the booking and order details from this messenger screenshot according to the active menu categories and strict field separation instructions."
                        }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                responseSchema = new
                {
                    type = "OBJECT",
                    properties = new Dictionary<string, object>
                    {
                        ["customerName"] = new { type = "STRING", description = "Recipient or customer name extracted from the booking form body (e.g. 'Name : Macel Mendoza' -> 'Macel Mendoza')" },
                        ["facebookName"] = new { type = "STRING", description = "Profile name shown in the top Messenger navigation bar/header (e.g. 'Macel Obina Mendoza'), or empty string if not visible" },
                        ["contactNumber"] = new { type = "STRING", description = "Primary contact mobile number (CP # 1)" },
                        ["targetDeliveryTime"] = new { type = "STRING", description = "Target delivery or pickup ISO-8601 date string (e.g. 2026-12-25T11:30:00) if visible, or null/empty" },
                        ["fulfillment"] = new { type = "INTEGER", description = "0 for Pickup, 1 for Delivery, 2 for Lalamove" },
                        ["deliveryAddress"] = new { type = "STRING", description = "Delivery destination address (null/empty if Pickup)" },
                        ["landmark"] = new { type = "STRING", description = "Dedicated landmark or drop-off guide labeled 'Landmark :' (e.g. 'Paseo de carmona'). Never put in remarks." },
                        ["eventType"] = new { type = "STRING", description = "Dedicated event or occasion labeled 'Type of Event :' or 'Event :' (e.g. 'Anniversary', 'Birthday', 'Binyag', 'Fiesta', 'Wedding', 'Corporate'). Never put in remarks." },
                        ["remarks"] = new { type = "STRING", description = "STRICTLY kitchen preparation, roasting, or packaging instructions plus secondary contact number (CP # 2). Must be empty string \"\" if none exist." },
                        ["deliveryFee"] = new { type = "NUMBER", description = "Explicitly stated delivery charge (e.g. 'Deliver Charge : 0' -> 0, 'Delivery Charge : 565' -> 565)" },
                        ["downpayment"] = new { type = "NUMBER", description = "Paid downpayment or deposit amount if noted (e.g. DP: 11,000 (paid))" },
                        ["items"] = new
                        {
                            type = "ARRAY",
                            items = new
                            {
                                type = "OBJECT",
                                properties = new Dictionary<string, object>
                                {
                                    ["itemCategoryId"] = new { type = "INTEGER", description = "Matched active category ID" },
                                    ["quantity"] = new { type = "INTEGER", description = "Quantity of this item (minimum 1)" }
                                },
                                required = new[] { "itemCategoryId", "quantity" }
                            }
                        }
                    },
                    required = new[] { "customerName", "contactNumber", "fulfillment", "remarks", "items" }
                }
            }
        };

        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(60);
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Authorization = null;

        // Prioritized multi-model cascade: Preferred Model -> Stable Flash -> Flash Lite -> Legacy fallbacks
        var configuredModel = _configuration["Gemini:Model"];
        var candidateList = new List<string>();
        if (!string.IsNullOrWhiteSpace(configuredModel))
        {
            candidateList.Add(configuredModel);
        }
        candidateList.AddRange(new[]
        {
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro"
        });

        var modelsToTry = candidateList
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        const int maxRetriesPerModel = 2; // Maximum 2 tries per model before cascading to the next candidate
        HttpResponseMessage? response = null;
        string? lastErrorDetails = null;

        var jsonContentString = JsonSerializer.Serialize(requestPayload);

        foreach (var currentModel in modelsToTry)
        {
            var requestUri = $"https://generativelanguage.googleapis.com/v1beta/models/{currentModel}:generateContent";

            for (int attempt = 1; attempt <= maxRetriesPerModel; attempt++)
            {
                response = null;
                using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
                {
                    Content = new StringContent(jsonContentString, Encoding.UTF8, "application/json")
                };

                // Clear any existing Authorization headers on the outgoing request
                request.Headers.Authorization = null;

                // Use the official Gemini API key header:
                request.Headers.Remove("x-goog-api-key");
                request.Headers.Add("x-goog-api-key", apiKey);

                try
                {
                    response = await httpClient.SendAsync(request);

                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("Successfully invoked Gemini model '{Model}' on attempt {Attempt}", currentModel, attempt);
                        break;
                    }

                    var statusCode = (int)response.StatusCode;
                    var errorBody = await response.Content.ReadAsStringAsync();
                    lastErrorDetails = $"Model '{currentModel}' failed with status {statusCode}: {errorBody}";
                    _logger.LogWarning(
                        "Gemini API returned status {StatusCode} on '{Model}' (Attempt {Attempt}/{MaxRetries}): {ErrorBody}",
                        statusCode, currentModel, attempt, maxRetriesPerModel, errorBody);

                    // If 404 (Model not found/deprecated) or 400 (Bad Request), don't retry same model - immediately cascade to next model
                    if (response.StatusCode == System.Net.HttpStatusCode.NotFound || response.StatusCode == System.Net.HttpStatusCode.BadRequest)
                    {
                        _logger.LogWarning("Model '{Model}' returned {StatusCode}. Skipping to next candidate model...", currentModel, statusCode);
                        break;
                    }

                    // If 503 (High demand / overloaded), 429 (Rate limit), or 502/504 (Transient Gateway errors)
                    if (statusCode == 503 || statusCode == 429 || statusCode == 502 || statusCode == 504)
                    {
                        if (attempt < maxRetriesPerModel)
                        {
                            // Jittered backoff: ~1.5s - 2.1s
                            var baseDelayMs = 1500 * attempt;
                            var jitterMs = Random.Shared.Next(200, 600);
                            await Task.Delay(baseDelayMs + jitterMs);
                            continue;
                        }
                        else
                        {
                            _logger.LogWarning(
                                "Model '{Model}' still overloaded after {MaxRetries} attempts. Cascading to next candidate model...",
                                currentModel, maxRetriesPerModel);
                            break;
                        }
                    }

                    // For any other unexpected HTTP status codes, break attempt loop to try next model
                    break;
                }
                catch (HttpRequestException ex)
                {
                    lastErrorDetails = $"Model '{currentModel}' network exception (Attempt {attempt}/{maxRetriesPerModel}): {ex.Message}";
                    _logger.LogWarning(ex,
                        "Transient network exception calling model '{Model}' (Attempt {Attempt}/{MaxRetries}): {Message}",
                        currentModel, attempt, maxRetriesPerModel, ex.Message);

                    if (attempt < maxRetriesPerModel)
                    {
                        var baseDelayMs = 1500 * attempt;
                        var jitterMs = Random.Shared.Next(200, 600);
                        await Task.Delay(baseDelayMs + jitterMs);
                        continue;
                    }
                }
                catch (Exception ex)
                {
                    lastErrorDetails = $"Model '{currentModel}' unexpected exception: {ex.Message}";
                    _logger.LogWarning(ex, "Unexpected error calling model '{Model}': {Message}", currentModel, ex.Message);
                    break;
                }
            }

            if (response != null && response.IsSuccessStatusCode)
            {
                break;
            }
        }

        if (response == null || !response.IsSuccessStatusCode)
        {
            var finalError = lastErrorDetails ?? "All candidate Gemini models failed to return a valid response.";
            _logger.LogError("Gemini vision intake failed across all models. Details: {Details}", finalError);
            throw new HttpRequestException($"Gemini vision parsing failed: {finalError}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);

        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("Gemini returned no response candidates. The screenshot may have been blocked or unreadable.");
        }

        var firstCandidate = candidates[0];
        if (!firstCandidate.TryGetProperty("content", out var contentElem) ||
            !contentElem.TryGetProperty("parts", out var parts) ||
            parts.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("Gemini response content parts were empty.");
        }

        var rawText = parts[0].GetProperty("text").GetString();
        if (string.IsNullOrWhiteSpace(rawText))
        {
            throw new InvalidOperationException("Gemini returned empty text payload.");
        }

        // Clean markdown fences if any
        var cleanedJson = rawText.Trim();
        if (cleanedJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            cleanedJson = cleanedJson.Substring(7);
        }
        if (cleanedJson.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            cleanedJson = cleanedJson.Substring(3);
        }
        if (cleanedJson.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            cleanedJson = cleanedJson.Substring(0, cleanedJson.Length - 3);
        }
        cleanedJson = cleanedJson.Trim();

        var rawDraft = JsonSerializer.Deserialize<RawGeminiDraft>(cleanedJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // 6. Map and sanitize into ParsedOrderDraftDto
        DateTime? targetDeliveryTime = null;
        if (!string.IsNullOrWhiteSpace(rawDraft?.TargetDeliveryTime) &&
            !rawDraft.TargetDeliveryTime.Equals("null", StringComparison.OrdinalIgnoreCase) &&
            !rawDraft.TargetDeliveryTime.Equals("n/a", StringComparison.OrdinalIgnoreCase))
        {
            if (DateTime.TryParse(rawDraft.TargetDeliveryTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt) ||
                DateTime.TryParse(rawDraft.TargetDeliveryTime, out dt))
            {
                targetDeliveryTime = dt;
            }
        }

        var validItems = new List<ParsedOrderItemDto>();
        if (rawDraft?.Items != null)
        {
            var activeCategoryMap = activeCategories.ToDictionary(c => c.Id);
            foreach (var item in rawDraft.Items)
            {
                if (activeCategoryMap.ContainsKey(item.ItemCategoryId))
                {
                    validItems.Add(new ParsedOrderItemDto
                    {
                        ItemCategoryId = item.ItemCategoryId,
                        Quantity = item.Quantity > 0 ? item.Quantity : 1
                    });
                }
                else
                {
                    _logger.LogWarning("Gemini returned unknown item category ID {CategoryId}", item.ItemCategoryId);
                }
            }
        }

        var fulfillment = rawDraft?.Fulfillment ?? 1;
        decimal? deliveryFee = rawDraft?.DeliveryFee;
        if (fulfillment == 0 || fulfillment == 2)
        {
            deliveryFee = 0;
        }

        return new ParsedOrderDraftDto
        {
            CustomerName = rawDraft?.CustomerName?.Trim() ?? string.Empty,
            FacebookName = string.IsNullOrWhiteSpace(rawDraft?.FacebookName) ? null : rawDraft.FacebookName.Trim(),
            ContactNumber = rawDraft?.ContactNumber?.Trim() ?? string.Empty,
            TargetDeliveryTime = targetDeliveryTime,
            Fulfillment = fulfillment,
            DeliveryAddress = fulfillment == 0 ? null : (string.IsNullOrWhiteSpace(rawDraft?.DeliveryAddress) ? null : rawDraft.DeliveryAddress.Trim()),
            Landmark = string.IsNullOrWhiteSpace(rawDraft?.Landmark) ? null : rawDraft.Landmark.Trim(),
            EventType = string.IsNullOrWhiteSpace(rawDraft?.EventType) ? null : rawDraft.EventType.Trim(),
            Remarks = string.IsNullOrWhiteSpace(rawDraft?.Remarks) ? string.Empty : rawDraft.Remarks.Trim(),
            DeliveryFee = deliveryFee,
            Downpayment = rawDraft?.Downpayment,
            Items = validItems
        };
    }

    private static ParsedOrderDraftDto GenerateMockOrderDraft(List<ItemCategory> activeCategories)
    {
        var selectedCategory = activeCategories.FirstOrDefault(c => c.Name.Equals("M", StringComparison.OrdinalIgnoreCase) || c.Name.Contains("Medium", StringComparison.OrdinalIgnoreCase))
                               ?? activeCategories.FirstOrDefault();

        return new ParsedOrderDraftDto
        {
            CustomerName = "Maria Santos",
            FacebookName = "Maria Obina Santos",
            ContactNumber = "09178901234",
            TargetDeliveryTime = DateTime.UtcNow.Date.AddDays(2).AddHours(12),
            Fulfillment = 1,
            DeliveryAddress = "Block 14 Lot 8, Camella Homes, Bacoor, Cavite",
            Landmark = "Near Gate 2 Clubhouse",
            EventType = "Birthday",
            Remarks = "",
            DeliveryFee = 150m,
            Downpayment = 2000m,
            Items = selectedCategory != null
                ? new List<ParsedOrderItemDto> { new() { ItemCategoryId = selectedCategory.Id, Quantity = 1 } }
                : new List<ParsedOrderItemDto>()
        };
    }

    private class RawGeminiDraft
    {
        public string? CustomerName { get; set; }
        public string? FacebookName { get; set; }
        public string? ContactNumber { get; set; }
        public string? TargetDeliveryTime { get; set; }
        public int? Fulfillment { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Landmark { get; set; }
        public string? EventType { get; set; }
        public string? Remarks { get; set; }
        public decimal? DeliveryFee { get; set; }
        public decimal? Downpayment { get; set; }
        public List<RawGeminiItem>? Items { get; set; }
    }

    private class RawGeminiItem
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}
