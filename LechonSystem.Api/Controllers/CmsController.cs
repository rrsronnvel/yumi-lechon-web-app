using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.Services;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Owner,Cashier")]
    public class CmsController : ControllerBase
    {
        private readonly ICmsService _cmsService;

        public CmsController(ICmsService cmsService)
        {
            _cmsService = cmsService;
        }

        // PUT: api/cms/categories/{id}/price
        [HttpPut("categories/{id}/price")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateCategoryPrice(int id, [FromBody] UpdatePriceRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            string adminName = User.Identity?.Name ?? request.AdminName ?? "System";
            bool success = await _cmsService.UpdateCategoryPriceAsync(id, request.NewPrice, adminName);

            if (!success)
            {
                return NotFound($"Item Category with ID {id} was not found.");
            }

            return Ok(new { message = "Price successfully updated and historical record logged." });
        }

        // POST: api/cms/categories
        [HttpPost("categories")]
        [Authorize(Roles = "Owner")]
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
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateCookingProfile(int id, [FromBody] UpdateCookingProfileRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var success = await _cmsService.UpdateCookingProfileAsync(id, request.TahiDurationMinutes, request.SalangDurationMinutes);

            if (!success) return NotFound($"Cooking profile with ID {id} was not found.");

            return Ok(new { message = "Cooking durations successfully updated!" });
        }

        // PATCH: api/cms/categories/{id}/toggle
        [HttpPatch("categories/{id}/toggle")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> ToggleCategoryActive(int id)
        {
            var success = await _cmsService.ToggleCategoryActiveAsync(id);
            if (!success) return NotFound();
            return Ok(new { message = "Item visibility toggled successfully!" });
        }

        // PATCH: api/cms/categories/{id}/clocks
        [HttpPatch("categories/{id}/clocks")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateClocks(int id, [FromBody] UpdateCookingProfileRequest request)
        {
            var success = await _cmsService.UpdateCookingProfileAsync(id, request.TahiDurationMinutes, request.SalangDurationMinutes);
            if (!success) return NotFound();
            return Ok(new { message = "Clocks updated and schedules recalculated!" });
        }

        // GET: api/cms/categories/{id}/price-history
        [HttpGet("categories/{id}/price-history")]
        public async Task<IActionResult> GetPriceHistory(int id)
        {
            var history = await _cmsService.GetPriceHistoryAsync(id);
            return Ok(history);
        }

        // PUT: api/cms/categories/{id}/details
        [HttpPut("categories/{id}/details")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateCategoryDetails(int id, [FromBody] CategoryMetadataDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _cmsService.UpdateCategoryDetailsAsync(id, dto);
                return Ok(new { message = "Category details successfully updated." });
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Item Category with ID {id} was not found.");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // PATCH: api/cms/categories/{id}/status
        [HttpPatch("categories/{id}/status")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> ToggleCategoryStatus(int id)
        {
            try
            {
                var result = await _cmsService.ToggleCategoryStatusAsync(id);
                return Ok(new { isActive = result });
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Item Category with ID {id} was not found.");
            }
        }
    }
}