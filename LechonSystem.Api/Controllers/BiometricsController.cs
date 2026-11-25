using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/biometrics")]
[Authorize(Roles = "Owner,Cashier")]
public sealed class BiometricsController(PayrollService payroll) : ControllerBase
{
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<IReadOnlyList<BiometricUploadDto>>> Upload([FromForm] List<IFormFile> files, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(User.Identity?.Name))
            return Unauthorized();

        try
        {
            return Ok(await payroll.UploadBiometricsAsync(files, User.Identity.Name, ct));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("recent-uploads")]
    public async Task<ActionResult<IReadOnlyList<BiometricUploadDto>>> RecentUploads(CancellationToken ct) =>
        Ok(await payroll.GetRecentBiometricUploadsAsync(ct));
}
