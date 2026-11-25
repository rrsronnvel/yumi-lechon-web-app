namespace LechonSystem.Api.DTOs;

public sealed record BiometricUploadDto(string FileName, DateOnly PeriodStart, DateOnly PeriodEnd,
    int PunchesImported, int DuplicatesSkipped, int UnmappedUserCount, DateTime ImportedAt, string ImportedBy);
