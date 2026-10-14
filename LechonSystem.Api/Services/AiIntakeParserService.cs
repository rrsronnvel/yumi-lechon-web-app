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

        // 4. Construct System Instruction with dynamic categories and disambiguation rules
        var promptBuilder = new StringBuilder();
        promptBuilder.AppendLine("You are an expert order intake specialist for Yumi Lechon in Cavite, Philippines.");
        promptBuilder.AppendLine("Your job is to parse incoming Facebook Messenger / chat screenshots of customer booking slips into a structured order draft.");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("CURRENT ACTIVE MENU CATEGORIES IN DATABASE:");
        foreach (var cat in activeCategories)
        {
            promptBuilder.AppendLine($"- Category ID: {cat.Id} | Name: \"{cat.Name}\" | Weight Range: {cat.MinimumWeightKg:F1}kg - {cat.MaximumWeightKg:F1}kg | Base Price: ₱{cat.BasePrice:N2}");
        }
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("CRITICAL EXTRACTION & DISAMBIGUATION RULES:");
        promptBuilder.AppendLine("1. Human-in-the-Loop Safety: Extract ONLY visibly confirmed booking data directly from the image. Do NOT invent, assume, or hallucinate missing dates, phone numbers, addresses, or items. If a value is missing or unclear, leave it null or empty.");
        promptBuilder.AppendLine("2. Menu Disambiguation:");
        promptBuilder.AppendLine("   - Match word-based sizes (\"Small\", \"Medium\", \"Large\", \"XXL\", \"Jumbo\") strictly to Whole Lechon categories (e.g., 'Small Whole', 'Medium Whole', 'Large Whole').");
        promptBuilder.AppendLine("   - Match kilogram weights (\"Belly 2kg\", \"Belly 3kg\", \"Belly 4kg\", \"Belly 5kg\", \"4kg Belly\", etc.) strictly to Lechon Belly categories.");
        promptBuilder.AppendLine("   - Match mentioned add-ons (e.g., \"Liver Sauce Only\", \"Extra Dinuguan\", \"Sauce\") to matching add-on category IDs from the active categories list above. If no exact category exists in the active menu list for a requested add-on, DO NOT invent a category ID; instead append the item name and quantity to 'remarks'.");
        promptBuilder.AppendLine("   - For each item in 'items', 'itemCategoryId' MUST be a valid Category ID from the active menu categories list above, and 'quantity' must be an integer >= 1.");
        promptBuilder.AppendLine("3. Contact & Note Concatenation:");
        promptBuilder.AppendLine("   - Primary phone (CP # 1 / Cellphone / Mobile) maps to 'contactNumber'.");
        promptBuilder.AppendLine("   - Secondary phone (CP # 2), landmark notes (e.g., 'near church', 'green gate'), event/occasion names (e.g., 'Baptismal', 'Birthday', 'Wedding'), and special culinary/cooking instructions must be bundled into 'remarks'.");
        promptBuilder.AppendLine("4. Fulfillment & Fee Rules:");
        promptBuilder.AppendLine("   - If 'Pickup' / 'Pick up' / 'Store pickup' is indicated: set 'fulfillment' = 0 and 'deliveryFee' = 0, and leave 'deliveryAddress' null or empty.");
        promptBuilder.AppendLine("   - If 'Delivery' is indicated: set 'fulfillment' = 1, extract 'deliveryAddress', and extract 'deliveryFee' if a delivery fee/charge is noted in the screenshot.");
        promptBuilder.AppendLine("5. Downpayment:");
        promptBuilder.AppendLine("   - Extract paid deposits or downpayments (e.g., 'DP : 11,000 (paid)', 'DP: 3,000', 'Downpayment: ₱5,000', 'Deposit: 2000') into 'downpayment' as a numeric amount. If only total price is shown without payment confirmation, downpayment should be null or 0.");
        promptBuilder.AppendLine("6. Target Delivery / Pickup Time:");
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
                            text = "Extract the booking and order details from this messenger screenshot according to the active menu categories and instructions."
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
                        ["customerName"] = new { type = "STRING", description = "Customer full name or buyer name" },
                        ["contactNumber"] = new { type = "STRING", description = "Primary contact mobile number" },
                        ["targetDeliveryTime"] = new { type = "STRING", description = "Target delivery or pickup ISO-8601 date string (e.g. 2026-12-25T11:30:00) if visible, or null/empty" },
                        ["fulfillment"] = new { type = "INTEGER", description = "0 for Pickup, 1 for Delivery" },
                        ["deliveryAddress"] = new { type = "STRING", description = "Delivery destination address (null if Pickup)" },
                        ["remarks"] = new { type = "STRING", description = "Secondary phone numbers, landmark notes, occasion (e.g. Baptismal), culinary notes, and unrecognized add-ons" },
                        ["deliveryFee"] = new { type = "NUMBER", description = "Delivery fee amount if specified, or 0 if Pickup" },
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
                    required = new[] { "customerName", "contactNumber", "fulfillment", "items" }
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
            "gemini-3.5-flash",
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
        if (fulfillment == 0)
        {
            deliveryFee = 0;
        }

        return new ParsedOrderDraftDto
        {
            CustomerName = rawDraft?.CustomerName?.Trim() ?? string.Empty,
            ContactNumber = rawDraft?.ContactNumber?.Trim() ?? string.Empty,
            TargetDeliveryTime = targetDeliveryTime,
            Fulfillment = fulfillment,
            DeliveryAddress = fulfillment == 0 ? null : (string.IsNullOrWhiteSpace(rawDraft?.DeliveryAddress) ? null : rawDraft.DeliveryAddress.Trim()),
            Remarks = string.IsNullOrWhiteSpace(rawDraft?.Remarks) ? null : rawDraft.Remarks.Trim(),
            DeliveryFee = deliveryFee,
            Downpayment = rawDraft?.Downpayment,
            Items = validItems
        };
    }

    private static ParsedOrderDraftDto GenerateMockOrderDraft(List<ItemCategory> activeCategories)
    {
        var selectedCategory = activeCategories.FirstOrDefault(c => c.Name.Contains("Medium", StringComparison.OrdinalIgnoreCase))
                               ?? activeCategories.FirstOrDefault();

        return new ParsedOrderDraftDto
        {
            CustomerName = "Maria Santos (Demo)",
            ContactNumber = "09178901234",
            TargetDeliveryTime = DateTime.UtcNow.Date.AddDays(2).AddHours(12),
            Fulfillment = 1,
            DeliveryAddress = "Block 14 Lot 8, Camella Homes, Bacoor, Cavite (Near Gate 2)",
            Remarks = "CP # 2: 09187654321. Event: 50th Birthday. Please make skin extra crispy and include extra sauce.",
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
        public string? ContactNumber { get; set; }
        public string? TargetDeliveryTime { get; set; }
        public int? Fulfillment { get; set; }
        public string? DeliveryAddress { get; set; }
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
