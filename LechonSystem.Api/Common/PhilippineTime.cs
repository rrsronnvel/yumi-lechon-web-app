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
    }
}
