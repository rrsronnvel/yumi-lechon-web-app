using System.Reflection;
using LechonSystem.Api.Controllers;
using LechonSystem.Api.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace LechonSystem.Api.Tests;

public class BiometricsIsolationTests
{
    [Fact]
    public void CashierCanReachOnlyTheDedicatedBiometricsController()
    {
        Assert.Equal("Owner,Cashier", typeof(BiometricsController).GetCustomAttribute<AuthorizeAttribute>()?.Roles);
        Assert.Equal("Owner", typeof(PayrollController).GetCustomAttribute<AuthorizeAttribute>()?.Roles);
    }

    [Fact]
    public void UploadContractExposesOnlyBatchMetadata()
    {
        Assert.Equal(new[] { "DuplicatesSkipped", "FileName", "ImportedAt", "ImportedBy", "PeriodEnd", "PeriodStart",
            "PunchesImported", "UnmappedUserCount" }, typeof(BiometricUploadDto).GetProperties().Select(p => p.Name).Order());
    }
}
