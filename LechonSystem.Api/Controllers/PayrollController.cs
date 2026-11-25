using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/payroll")]
[Authorize(Roles = "Owner")]
public sealed class PayrollController(PayrollService payroll) : ControllerBase
{
    private string Actor => User.Identity?.Name ?? "Owner";

    [HttpGet("employees")]
    public Task<IActionResult> GetEmployees(CancellationToken ct) => Respond(() => payroll.GetEmployeesAsync(ct));

    [HttpPost("employees")]
    public Task<IActionResult> AddEmployee(EmployeeInput input, CancellationToken ct) => Respond(() => payroll.SaveEmployeeAsync(null, input, ct));

    [HttpPut("employees/{id:int}")]
    public Task<IActionResult> UpdateEmployee(int id, EmployeeInput input, CancellationToken ct) =>
        Respond(() => payroll.SaveEmployeeAsync(id, input, ct));

    [HttpPatch("employees/{id:int}/status")]
    public Task<IActionResult> UpdateEmployeeStatus(int id, EmployeeStatusInput input, CancellationToken ct) =>
        Respond(() => payroll.SetEmployeeStatusAsync(id, input.IsActive, ct));

    [HttpGet("settings")]
    public Task<IActionResult> GetSettings(CancellationToken ct) => Respond(() => payroll.GetSettingsAsync(ct));

    [HttpPut("settings")]
    public Task<IActionResult> UpdateSettings(PayrollSettingsDto input, CancellationToken ct) =>
        Respond(() => payroll.SaveSettingsAsync(input, Actor, ct));

    [HttpGet("holidays")]
    public Task<IActionResult> GetHolidays(CancellationToken ct) => Respond(() => payroll.GetHolidaysAsync(ct));

    [HttpPut("holidays")]
    public Task<IActionResult> UpdateHoliday(PayrollHolidayDto input, CancellationToken ct) =>
        Respond(() => payroll.SaveHolidayAsync(input, ct));

    [HttpPost("attendance/import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public Task<IActionResult> ImportAttendance([FromForm] List<IFormFile> files, CancellationToken ct) =>
        Respond(() => payroll.ImportAttendanceAsync(files, Actor, ct));

    [HttpGet("attendance")]
    public Task<IActionResult> GetAttendance([FromQuery] DateOnly startDate, [FromQuery] DateOnly endDate, CancellationToken ct) =>
        Respond(() => payroll.GetAttendanceAsync(startDate, endDate, ct));

    [HttpPut("attendance/{id:int}")]
    public Task<IActionResult> UpdateAttendance(int id, AttendanceInput input, CancellationToken ct) =>
        Respond(() => payroll.UpdateAttendanceAsync(id, input, Actor, ct));

    [HttpPost("attendance/manual")]
    public Task<IActionResult> AddAttendance(ManualAttendanceInput input, CancellationToken ct) =>
        Respond(() => payroll.AddAttendanceAsync(input, Actor, ct));

    [HttpPost("attendance/{id:int}/overtime-decision")]
    public Task<IActionResult> DecideOvertime(int id, OvertimeDecisionInput input, CancellationToken ct) =>
        Respond(() => payroll.DecideOvertimeAsync(id, input, Actor, ct));

    [HttpGet("roast-production")]
    public Task<IActionResult> GetRoastProduction([FromQuery] DateOnly startDate, [FromQuery] DateOnly endDate, CancellationToken ct) =>
        Respond(() => payroll.GetRoastProductionAsync(startDate, endDate, ct));

    [HttpPut("roast-production")]
    public Task<IActionResult> UpdateRoastProduction(List<RoastCountInput> inputs, CancellationToken ct) =>
        Respond(() => payroll.SaveRoastProductionAsync(inputs, Actor, ct));

    [HttpPut("roast-production/{date}/allocations")]
    public Task<IActionResult> UpdateRoastAllocations(DateOnly date, RoastAllocationsInput input, CancellationToken ct) =>
        Respond(() => payroll.SaveRoastAllocationsAsync(date, input, Actor, ct));

    [HttpPut("roast-production/{date}/teams")]
    public Task<IActionResult> UpdateRoastTeams(DateOnly date, RoastTeamsInput input, CancellationToken ct) =>
        Respond(() => payroll.SaveRoastTeamsAsync(date, input, Actor, ct));

    [HttpGet("roast-production/last-teams")]
    public Task<IActionResult> GetLastRoastTeams([FromQuery] DateOnly beforeDate, CancellationToken ct) =>
        Respond(() => payroll.GetLastRoastTeamsAsync(beforeDate, ct));

    [HttpPost("roast-production/prefill")]
    public Task<IActionResult> PrefillRoastProduction([FromQuery] DateOnly startDate, [FromQuery] DateOnly endDate, CancellationToken ct) =>
        Respond(() => payroll.PrefillRoastProductionAsync(startDate, endDate, ct));

    [HttpGet("vale")]
    public Task<IActionResult> GetVale([FromQuery] DateOnly? asOf, CancellationToken ct) =>
        Respond(() => payroll.GetValeAsync(asOf, ct));

    [HttpPost("vale")]
    public Task<IActionResult> RecordVale(ValeInput input, CancellationToken ct) => Respond(() => payroll.RecordValeAsync(input, Actor, ct));

    [HttpPost("vale/{id:int}/void")]
    public Task<IActionResult> VoidVale(int id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ValeVoidInput? input, CancellationToken ct) =>
        Respond(() => payroll.VoidValeAsync(id, input, Actor, ct));

    [HttpGet("periods")]
    public Task<IActionResult> GetPeriods(CancellationToken ct) => Respond(() => payroll.GetPeriodsAsync(ct));

    [HttpPost("periods/preview")]
    public Task<IActionResult> PreviewPeriod(PayrollDateRange input, CancellationToken ct) => Respond(() => payroll.PreviewPeriodAsync(input, ct));

    [HttpPut("periods/{id:int}/items/{itemId:int}")]
    public Task<IActionResult> UpdatePayrollItem(int id, int itemId, PayrollItemInput input, CancellationToken ct) =>
        Respond(() => payroll.UpdatePayrollItemAsync(id, itemId, input, ct));

    [HttpPost("periods/{id:int}/finalize")]
    public Task<IActionResult> FinalizePeriod(int id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] PayrollFinalizeInput? input, CancellationToken ct) =>
        Respond(() => payroll.FinalizePeriodAsync(id, input, Actor, ct));

    [HttpPost("periods/{id:int}/sync-expense")]
    public Task<IActionResult> SyncPeriodExpense(int id, CancellationToken ct) =>
        Respond(() => payroll.SyncPeriodExpenseAsync(id, Actor, ct));

    private async Task<IActionResult> Respond<T>(Func<Task<T>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
        catch (PayrollConflictException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}
