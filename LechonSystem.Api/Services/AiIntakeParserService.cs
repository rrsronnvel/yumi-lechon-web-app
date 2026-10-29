using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
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
        promptBuilder.AppendLine("CRITICAL 4-PHASE EXTRACTION & FIELD-SEPARATION RULES:");
        promptBuilder.AppendLine("The booking may be a minimal customer reply or a longer staff-annotated four-phase template. Labels may be reordered, split across lines, piped together, or partially blank. Parse by label and meaning rather than fixed line position.");
        promptBuilder.AppendLine("1. HUMAN-IN-THE-LOOP SAFETY: Extract ONLY visibly confirmed booking data. Never invent a missing date, phone, address, amount, item, or instruction. Use null/empty for unclear values.");
        promptBuilder.AppendLine("2. PHASE 1 - CUSTOMER AND FULFILLMENT:");
        promptBuilder.AppendLine("   - 'facebookName' comes only from the Messenger header/profile name. 'customerName' comes from the booking body label 'Name :'.");
        promptBuilder.AppendLine("   - CP#/Cp:/Contact#/Contact:/Phone:/Mobile: (including labels with no space before the number) maps to contactNumber. 'CP # 2 :' maps only to contactNumber2. NEVER put CP # 2 into remarks.");
        promptBuilder.AppendLine("   - 'Pickup or Deliver :' maps Pickup/Pick-up to fulfillment 0, Lalamove to 2, and Delivery/Deliver to 1.");
        promptBuilder.AppendLine("   - Del Add:/Deliver:/Delivery:/Delivery Address:/Address:/Location: maps to deliveryAddress; Landmark: maps to landmark. Never copy either into remarks.");
        promptBuilder.AppendLine("3. PHASE 2 - SCHEDULE, EVENT, AND ORDER:");
        promptBuilder.AppendLine("   - Parse Date & Time:/Date and Time: even when date and time are on separate lines or a range. Examples: 'Nov. 6 /10-10:30 am' => 2026-11-06T10:00:00 or 2026-11-06T10:30:00; 'October 24,2026' followed by '10 in the morning' => 2026-10-24T10:00:00. Morning means AM; afternoon/evening means PM. Date-only input is valid. If no year is present, infer 2026.");
        promptBuilder.AppendLine("   - 'Type of Event :' maps to eventType (Birthday, Anniversary, Binyag/Baptismal, Wedding, Fiesta, Corporate, or Other). If text says Birthday/Fiesta, use Birthday.");
        promptBuilder.AppendLine("   - Parse Order / Size into items using strict specificity: S. Jumbo/Super Jumbo/S Jumbo, Jumbo, XXL/2XL/XX-Large/Double Extra Large/Double XL, XL/1XL/X-Large/X Large/Extra Large, XXS variants, XS variants, then standalone Large/L, Medium/Med/M, Small/S. X-Large must map to XL and must never fall through to Large/L. Ignore trailing 'with 7 freebies/frebbies'.");
        promptBuilder.AppendLine("   - Parse both 'Add-ons :' quantities (for example '2 sarsa') and 'Additional {Item} : {Amount}' lines into items by matching Sarsa, Dinuguan, Pancit/Pansit, Palabok, Spaghetti, Puto, or Coke to active category IDs. The number after an Additional-item colon may be a price, not a quantity; use quantity 1 unless an explicit quantity is shown.");
        promptBuilder.AppendLine("   - Every itemCategoryId must exist in the active menu above, and every quantity must be an integer >= 1.");
        promptBuilder.AppendLine("4. PHASE 3 - FREEBIES, DELIVERY, AND PRICING:");
        promptBuilder.AppendLine("   - For Freebies or Less 2k, Freebies or Cash Discount, No Freebies, or a Price containing (less 2000): set freebiesOptOut=true for a discount selection. Set freebiesOptOut=false for 'with 7 freebies', including a leading check mark.");
        promptBuilder.AppendLine("   - Put an explicitly stated numeric discount in 'discount'. Do not treat the total price or total balance as a discount.");
        promptBuilder.AppendLine("   - Parse 'Distance :' into numeric distanceKm and 'Delivery Charge :' or 'Deliver Charge :' into numeric deliveryFee.");
        promptBuilder.AppendLine("   - Pickup sets deliveryFee=0 and leaves deliveryAddress empty. Lalamove sets deliveryFee=0 but may retain its destination. Delivery retains an explicitly stated fee.");
        promptBuilder.AppendLine("5. PHASE 4 - PAYMENT AND SPECIAL REQUEST:");
        promptBuilder.AppendLine("   - Parse DP & Mode, DP, Downpayment, or Deposit into numeric downpayment, stripping trailing notes such as '(paid)'. Parse its channel into downpaymentMethod exactly as Cash, GCash, Maya, or Bank Transfer. If a positive DP has no visible channel, use GCash.");
        promptBuilder.AppendLine("   - Only the value of 'Special Request :' may populate remarks. Never append unlabeled template prose or metadata. If it says 'walang dinuguan', 'hilaw na laman loob', or raw innards, set rawInnards=true while preserving the culinary request in remarks.");
        promptBuilder.AppendLine("6. STRICT BOILERPLATE STRIPPER: remarks must NEVER contain any line beginning with or containing 'To confirm your order...', 'WITH 7 FREEBIES', 'Spaghetti, Palabok & Pansit should be consumed...', 'Delivery Suggestion :', 'Kung gusto nyo po ng mas masarap...', or 'Total Balance :'. If there is no Special Request value, remarks must be an empty string.");

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
                        ["contactNumber2"] = new { type = "STRING", description = "Secondary contact mobile number from CP # 2 only; never include it in remarks" },
                        ["targetDeliveryTime"] = new { type = "STRING", description = "Target delivery or pickup ISO-8601 date string (e.g. 2026-12-25T11:30:00) if visible, or null/empty" },
                        ["fulfillment"] = new { type = "INTEGER", description = "0 for Pickup, 1 for Delivery, 2 for Lalamove" },
                        ["deliveryAddress"] = new { type = "STRING", description = "Delivery destination address (null/empty if Pickup)" },
                        ["landmark"] = new { type = "STRING", description = "Dedicated landmark or drop-off guide labeled 'Landmark :' (e.g. 'Paseo de carmona'). Never put in remarks." },
                        ["eventType"] = new { type = "STRING", description = "Dedicated event or occasion labeled 'Type of Event :' or 'Event :' (e.g. 'Anniversary', 'Birthday', 'Binyag', 'Fiesta', 'Wedding', 'Corporate'). Never put in remarks." },
                        ["remarks"] = new { type = "STRING", description = "Only the culinary/packaging value labeled Special Request; no CP # 2, metadata, totals, or boilerplate. Empty string if absent." },
                        ["freebiesOptOut"] = new { type = "BOOLEAN", description = "True for Less 2k, Cash Discount, No/Walang Freebies; false when freebies are selected; omitted if unclear" },
                        ["rawInnards"] = new { type = "BOOLEAN", description = "True when Special Request says walang dinuguan, hilaw na laman loob, or raw innards" },
                        ["distanceKm"] = new { type = "NUMBER", description = "Numeric kilometers explicitly stated in Distance" },
                        ["discount"] = new { type = "NUMBER", description = "Explicit numeric discount, excluding total price and total balance" },
                        ["deliveryFee"] = new { type = "NUMBER", description = "Explicitly stated delivery charge (e.g. 'Deliver Charge : 0' -> 0, 'Delivery Charge : 565' -> 565)" },
                        ["downpayment"] = new { type = "NUMBER", description = "Paid downpayment or deposit amount if noted (e.g. DP: 11,000 (paid))" },
                        ["downpaymentMethod"] = new { type = "STRING", description = "Cash, GCash, Maya, or Bank Transfer; defaults to GCash only when downpayment is positive and no mode is visible" },
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

        var remarks = SanitizeRemarks(rawDraft?.Remarks);
        var rawInnards = (rawDraft?.RawInnards ?? false)
            || Regex.IsMatch(remarks, @"walang\s+dinuguan|hilaw\s+na\s+laman\s+loob|raw\s+innards?", RegexOptions.IgnoreCase);

        string? downpaymentMethod = null;
        if (!string.IsNullOrWhiteSpace(rawDraft?.DownpaymentMethod))
        {
            downpaymentMethod = PaymentChannels.Normalize(
                rawDraft.DownpaymentMethod,
                rawDraft.Downpayment.GetValueOrDefault() > 0 ? "GCash" : "Cash");
        }
        else if (rawDraft?.Downpayment.GetValueOrDefault() > 0)
        {
            downpaymentMethod = "GCash";
        }

        return new ParsedOrderDraftDto
        {
            CustomerName = rawDraft?.CustomerName?.Trim() ?? string.Empty,
            FacebookName = string.IsNullOrWhiteSpace(rawDraft?.FacebookName) ? null : rawDraft.FacebookName.Trim(),
            ContactNumber = rawDraft?.ContactNumber?.Trim() ?? string.Empty,
            ContactNumber2 = string.IsNullOrWhiteSpace(rawDraft?.ContactNumber2) ? null : rawDraft.ContactNumber2.Trim(),
            TargetDeliveryTime = targetDeliveryTime,
            Fulfillment = fulfillment,
            DeliveryAddress = fulfillment == 0 ? null : (string.IsNullOrWhiteSpace(rawDraft?.DeliveryAddress) ? null : rawDraft.DeliveryAddress.Trim()),
            Landmark = string.IsNullOrWhiteSpace(rawDraft?.Landmark) ? null : rawDraft.Landmark.Trim(),
            EventType = string.IsNullOrWhiteSpace(rawDraft?.EventType) ? null : rawDraft.EventType.Trim(),
            Remarks = remarks,
            FreebiesOptOut = rawDraft?.FreebiesOptOut,
            RawInnards = rawInnards,
            DistanceKm = rawDraft?.DistanceKm,
            Discount = rawDraft?.Discount,
            DeliveryFee = deliveryFee,
            Downpayment = rawDraft?.Downpayment,
            DownpaymentMethod = downpaymentMethod,
            Items = validItems
        };
    }

    private static string SanitizeRemarks(string? rawRemarks)
    {
        if (string.IsNullOrWhiteSpace(rawRemarks))
        {
            return string.Empty;
        }

        const string boilerplatePattern = @"to\s+confirm\s+your\s+order|with\s+7\s+freebies|spaghetti\s*,\s*palabok.*consumed|delivery\s+suggestion\s*:|kung\s+gusto\s+nyo\s+po\s+ng\s+mas\s+masarap|total\s+balance\s*:";
        var sanitizedLines = rawRemarks
            .Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries)
            .Where(line => !Regex.IsMatch(line, boilerplatePattern, RegexOptions.IgnoreCase))
            .Select(line => Regex.Replace(
                line,
                @"\bCP\s*#?\s*2\s*:?.*$",
                string.Empty,
                RegexOptions.IgnoreCase).Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line));

        return string.Join(Environment.NewLine, sanitizedLines).Trim();
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
            ContactNumber2 = "09981234567",
            TargetDeliveryTime = DateTime.UtcNow.Date.AddDays(2).AddHours(12),
            Fulfillment = 1,
            DeliveryAddress = "Block 14 Lot 8, Camella Homes, Bacoor, Cavite",
            Landmark = "Near Gate 2 Clubhouse",
            EventType = "Birthday",
            Remarks = "",
            FreebiesOptOut = false,
            RawInnards = false,
            DistanceKm = 10m,
            Discount = 0m,
            DeliveryFee = 150m,
            Downpayment = 2000m,
            DownpaymentMethod = "GCash",
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
        public string? ContactNumber2 { get; set; }
        public string? TargetDeliveryTime { get; set; }
        public int? Fulfillment { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Landmark { get; set; }
        public string? EventType { get; set; }
        public string? Remarks { get; set; }
        public bool? FreebiesOptOut { get; set; }
        public bool? RawInnards { get; set; }
        public decimal? DistanceKm { get; set; }
        public decimal? Discount { get; set; }
        public decimal? DeliveryFee { get; set; }
        public decimal? Downpayment { get; set; }
        public string? DownpaymentMethod { get; set; }
        public List<RawGeminiItem>? Items { get; set; }
    }

    private class RawGeminiItem
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}
