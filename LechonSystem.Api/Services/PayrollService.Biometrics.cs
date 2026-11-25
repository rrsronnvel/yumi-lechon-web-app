using LechonSystem.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    public async Task<IReadOnlyList<BiometricUploadDto>> UploadBiometricsAsync(IReadOnlyList<IFormFile> files, string actor,
        CancellationToken ct)
    {
        var import = await ImportAttendanceAsync(files, actor, ct);
        return import.Batches.Select(batch => new BiometricUploadDto(batch.FileName, batch.PeriodStart, batch.PeriodEnd,
            batch.PunchesImported, batch.DuplicatesSkipped, batch.UnmappedUserCount, batch.ImportedAt, batch.ImportedBy)).ToList();
    }

    public async Task<IReadOnlyList<BiometricUploadDto>> GetRecentBiometricUploadsAsync(CancellationToken ct) =>
        await db.BiometricImportBatches.AsNoTracking().OrderByDescending(batch => batch.ImportedAt)
            .ThenByDescending(batch => batch.Id).Take(10)
            .Select(batch => new BiometricUploadDto(batch.FileName, batch.PeriodStart, batch.PeriodEnd, batch.PunchesImported,
                batch.DuplicatesSkipped, batch.UnmappedUserCount, batch.ImportedAt, batch.ImportedBy)).ToListAsync(ct);
}
