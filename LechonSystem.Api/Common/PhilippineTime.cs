namespace LechonSystem.Api.Common
{
    public static class PhilippineTime
    {
        private static readonly TimeZoneInfo PhtZone =
            OperatingSystem.IsWindows()
                ? TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time")
                : TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

        public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, PhtZone);
        public static DateTime Today => Now.Date;
        public static DateTime Tomorrow => Today.AddDays(1);

        public static DateTime NormalizeYear(DateTime dt, int targetYear = 0)
        {
            if (dt.Year >= 2025) return dt;
            int year = targetYear > 0 ? targetYear : Today.Year;
            int day = Math.Min(dt.Day, DateTime.DaysInMonth(year, dt.Month));
            return new DateTime(year, dt.Month, day, dt.Hour, dt.Minute, dt.Second, dt.Millisecond, dt.Kind);
        }
    }
}
