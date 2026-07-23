using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.Services;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CmsController : ControllerBase
    {
        private readonly ICmsService _cmsService;

        public CmsController(ICmsService cmsService)
        {
            _cmsService = cmsService;
        }

        // PUT: api/cms/categories/{id}/price
        [HttpPut("categories/{id}/price")]
        public async Task<IActionResult> UpdateCategoryPrice(int id, [FromBody] UpdatePriceRequest request)
        {
            // If the React form sent bad data (like a negative price), block it instantly!
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Call the engine room logic you built in Step 1
            // Default to "System" if the React UI didn't pass a specific AdminName
            string adminName = request.AdminName ?? "System";

            bool success = await _cmsService.UpdateCategoryPriceAsync(id, request.NewPrice, adminName);

            if (!success)
            {
                return NotFound($"Item Category with ID {id} was not found.");
            }

            // 200 OK - Return a clean success message
            return Ok(new { message = "Price successfully updated and historical record logged." });
        }


        // POST: api/cms/categories
        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var newCategory = await _cmsService.CreateCategoryAsync(request);

            return Ok(new { message = "New menu item successfully created!", category = newCategory });
        }


        // PATCH: api/cms/cooking-profiles/{id}
        [HttpPatch("cooking-profiles/{id}")]
        public async Task<IActionResult> UpdateCookingProfile(int id, [FromBody] UpdateCookingProfileRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var success = await _cmsService.UpdateCookingProfileAsync(id, request.TahiDurationMinutes, request.SalangDurationMinutes);

            if (!success) return NotFound($"Cooking profile with ID {id} was not found.");

            return Ok(new { message = "Cooking durations successfully updated!" });
        }

        // PATCH: api/cms/categories/{id}/toggle
        [HttpPatch("categories/{id}/toggle")]
        public async Task<IActionResult> ToggleCategoryActive(int id)
        {
            var success = await _cmsService.ToggleCategoryActiveAsync(id);
            if (!success) return NotFound();
            return Ok(new { message = "Item visibility toggled successfully!" });
        }

        // PATCH: api/cms/categories/{id}/clocks
        [HttpPatch("categories/{id}/clocks")]
        public async Task<IActionResult> UpdateClocks(int id, [FromBody] UpdateCookingProfileRequest request)
        {
            var success = await _cmsService.UpdateCookingProfileAsync(id, request.TahiDurationMinutes, request.SalangDurationMinutes);
            if (!success) return NotFound();
            return Ok(new { message = "Clocks updated and schedules recalculated!" });
        }
    }
}