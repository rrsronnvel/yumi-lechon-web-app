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
    }
}