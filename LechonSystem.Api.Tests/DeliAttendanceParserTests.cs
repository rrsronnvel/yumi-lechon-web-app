using LechonSystem.Api.Services;

namespace LechonSystem.Api.Tests;

public class DeliAttendanceParserTests
{
    [Fact]
    public void NovemberWorkbookReturnsAllFivePunchesAtPhilippineWallTime()
    {
        var start = new DateOnly(2026, 11, 1);
        var end = new DateOnly(2026, 11, 23);
        using var file = DeliBiff8Fixture.Create(start, end, [(23, "06:04\n06:08"), (23, "06:09\n06:13"), (23, "06:18\n     ")]);

        var export = new DeliAttendanceParser().Parse(file);

        Assert.Equal(start, export.PeriodStart);
        Assert.Equal(end, export.PeriodEnd);
        Assert.Equal(new[] { 4, 8, 9, 13, 18 }.Select(minute => end.ToDateTime(new TimeOnly(6, minute))),
            export.Punches.Select(punch => punch.PunchTime));
        Assert.All(export.Punches, punch =>
        {
            Assert.Equal(1, punch.BiometricUserId);
            Assert.Equal("test1", punch.BiometricNameSnapshot);
            Assert.Equal(DateTimeKind.Unspecified, punch.PunchTime.Kind);
        });
    }

    [Theory]
    [InlineData("Attendance Report")]
    [InlineData("Abnormal Report")]
    [InlineData("Shift Setting Table")]
    [InlineData("Attendance Statistic Table")]
    public void ShiftReportsGiveRawExportGuidance(string title)
    {
        using var file = DeliBiff8Fixture.Create(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 23), [], title);

        var error = Assert.Throws<ArgumentException>(() => new DeliAttendanceParser().Parse(file));

        Assert.Equal("Wrong Deli export file. Please upload 'Employee Attendance Record.xls' (raw timestamps) instead of Attendance Report or Abnormal Report.", error.Message);
    }
}
