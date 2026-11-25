using System.Text;
using Microsoft.AspNetCore.Http;

namespace LechonSystem.Api.Tests;

internal static class DeliBiff8Fixture
{
    static DeliBiff8Fixture() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    public static MemoryStream Create(DateOnly start, DateOnly end, (int Day, string Cell)[] punchRows,
        string title = "Employee Attendance Record")
    {
        var stream = new MemoryStream();
        using var workbook = new BinaryWriter(stream, Encoding.ASCII, leaveOpen: true);

        // A raw BIFF8 worksheet with the same user labels, sparse columns and text cells as the USB export.
        Record(0x0809, record =>
        {
            record.Write((ushort)0x0600); // BIFF8
            record.Write((ushort)0x0010); // Worksheet
            record.Write(new byte[12]);
        });
        Label(0, 0, title);
        Label(2, 6, FormattableString.Invariant($"Attendance date:{start:yyyy-MM-dd}~{end:yyyy-MM-dd}"));
        Label(4, 1, "User ID:");
        Number(4, 3, 1);
        Label(4, 5, "Name:");
        Label(4, 6, "test1");
        for (ushort day = 1; day <= 31; day++)
            Number(5, day, day);
        for (var index = 0; index < punchRows.Length; index++)
            Label((ushort)(6 + index), (ushort)punchRows[index].Day, punchRows[index].Cell);
        Record(0x000A, _ => { }); // End of worksheet
        stream.Position = 0;
        return stream;

        void Label(ushort row, ushort column, string value) => Record(0x0204, record =>
        {
            record.Write(row);
            record.Write(column);
            record.Write((ushort)0); // XF index
            record.Write((ushort)value.Length);
            record.Write((byte)0); // Compressed Unicode
            record.Write(Encoding.ASCII.GetBytes(value));
        });

        void Number(ushort row, ushort column, double value) => Record(0x0203, record =>
        {
            record.Write(row);
            record.Write(column);
            record.Write((ushort)0);
            record.Write(value);
        });

        void Record(ushort id, Action<BinaryWriter> write)
        {
            using var payload = new MemoryStream();
            using var record = new BinaryWriter(payload);
            write(record);
            workbook.Write(id);
            workbook.Write((ushort)payload.Length);
            workbook.Write(payload.ToArray());
        }
    }

    public static FormFile AsUpload(Stream stream) =>
        new(stream, 0, stream.Length, "files", "Employee Attendance Record.xls");
}
