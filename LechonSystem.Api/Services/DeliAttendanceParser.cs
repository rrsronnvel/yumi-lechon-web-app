using System.Globalization;
using System.Text.RegularExpressions;
using ExcelDataReader;
using ExcelDataReader.Exceptions;

namespace LechonSystem.Api.Services;

public sealed record DeliPunch(int BiometricUserId, string? BiometricNameSnapshot, DateTime PunchTime);
public sealed record DeliAttendanceExport(DateOnly PeriodStart, DateOnly PeriodEnd, IReadOnlyList<DeliPunch> Punches);

public sealed partial class DeliAttendanceParser
{
    public const string WrongExportMessage = "Wrong Deli export file. Please upload 'Employee Attendance Record.xls' (raw timestamps) instead of Attendance Report or Abnormal Report.";
    private const string ReportTitle = "Employee Attendance Record";
    private const string UserIdLabel = "User ID:";
    private const string NameLabel = "Name:";

    [GeneratedRegex(@"Attendance date:\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PeriodPattern();

    [GeneratedRegex(@"\b([01][0-9]|2[0-3]):([0-5][0-9])\b")]
    private static partial Regex PunchPattern();

    public DeliAttendanceExport Parse(Stream stream, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = ExcelReaderFactory.CreateBinaryReader(stream, new ExcelReaderConfiguration { LeaveOpen = true });
            do
            {
                var topRows = new List<string[]>();
                while (topRows.Count < 5 && reader.Read())
                    topRows.Add(ReadRow(reader));

                if (reader.Name?.Contains(ReportTitle, StringComparison.OrdinalIgnoreCase) == true ||
                    topRows.Any(row => row.Any(cell => cell.Contains(ReportTitle, StringComparison.OrdinalIgnoreCase))))
                    return ParseAttendanceSheet(reader, topRows, cancellationToken);
            } while (reader.NextResult());
        }
        catch (Exception exception) when (exception is ExcelReaderException or IOException)
        {
            throw new ArgumentException(WrongExportMessage, exception);
        }

        throw new ArgumentException(WrongExportMessage);
    }

    private static DeliAttendanceExport ParseAttendanceSheet(IExcelDataReader reader, List<string[]> topRows,
        CancellationToken cancellationToken)
    {
        var pattern = PeriodPattern();
        var period = topRows.SelectMany(row => row).Select(cell => pattern.Match(cell)).FirstOrDefault(match => match.Success);
        if (period is null ||
            !DateOnly.TryParseExact(period.Groups[1].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
            !DateOnly.TryParseExact(period.Groups[2].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end) ||
            end < start)
            throw new ArgumentException("The Deli export is missing a valid Attendance date header in the first five rows.");

        int? userId = null;
        string? name = null;
        var expectDayRow = false;
        var days = new Dictionary<int, DateOnly>();
        var punches = new List<DeliPunch>();

        void ReadEmployeeRow(string[] cells)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var idColumn = FindLabel(cells, UserIdLabel);
            if (idColumn >= 0)
            {
                var idText = LabelValue(cells, idColumn, UserIdLabel, skipBlank: true);
                if (!int.TryParse(idText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) || id <= 0)
                    throw new ArgumentException("A Deli employee block has an invalid User ID. Check the export and try again.");

                userId = id;
                var nameColumn = FindLabel(cells, NameLabel);
                name = LabelValue(cells, nameColumn, NameLabel, skipBlank: false);
                expectDayRow = true;
                return;
            }

            if (userId is null)
                return;

            if (expectDayRow)
            {
                days.Clear();
                var daysInMonth = DateTime.DaysInMonth(start.Year, start.Month);
                for (var column = 0; column < cells.Length; column++)
                {
                    if (int.TryParse(cells[column], NumberStyles.Integer, CultureInfo.InvariantCulture, out var day) &&
                        day >= 1 && day <= daysInMonth)
                        days.Add(column, new DateOnly(start.Year, start.Month, day));
                }

                expectDayRow = false;
                return;
            }

            foreach (var (column, date) in days)
            {
                if (column >= cells.Length || cells[column].Length == 0)
                    continue;

                foreach (Match match in PunchPattern().Matches(cells[column]))
                {
                    var hour = int.Parse(match.Groups[1].ValueSpan, CultureInfo.InvariantCulture);
                    var minute = int.Parse(match.Groups[2].ValueSpan, CultureInfo.InvariantCulture);
                    punches.Add(new DeliPunch(userId.Value, name, date.ToDateTime(new TimeOnly(hour, minute))));
                }
            }
        }

        foreach (var row in topRows)
            ReadEmployeeRow(row);
        while (reader.Read())
            ReadEmployeeRow(ReadRow(reader));

        return new DeliAttendanceExport(start, end, punches);
    }

    private static string[] ReadRow(IExcelDataReader reader)
    {
        var cells = new string[reader.FieldCount];
        for (var column = 0; column < cells.Length; column++)
            cells[column] = Convert.ToString(reader.GetValue(column), CultureInfo.InvariantCulture)?.Trim() ?? "";
        return cells;
    }

    private static int FindLabel(string[] cells, string label) =>
        Array.FindIndex(cells, cell => cell.StartsWith(label, StringComparison.OrdinalIgnoreCase));

    private static string? LabelValue(string[] cells, int column, string label, bool skipBlank)
    {
        if (column < 0)
            return null;

        var inline = cells[column][label.Length..].Trim();
        if (inline.Length > 0)
            return inline;

        var next = column + 1;
        while (skipBlank && next < cells.Length && cells[next].Length == 0)
            next++;

        return next < cells.Length && cells[next].Length > 0 ? cells[next] : null;
    }
}
