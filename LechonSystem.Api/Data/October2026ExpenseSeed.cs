using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

/// <summary>
/// Compiled, deployment-safe copy of the real October 2026 expense ledger.
/// Source: October Expense log.xlsx / Oct 2026 Expenses Log, rows 6-346.
/// </summary>
public static class October2026ExpenseSeed
{
    public const string SeededBy = "October 2026 Excel Seed";
    public const int ExpectedRowCount = 341;
    public const decimal ExpectedCogsTotal = 245677.00m;
    public const decimal ExpectedOpexTotal = 395543.00m;
    public const decimal ExpectedGrandTotal = 641220.00m;

    public static IReadOnlyList<October2026ExpenseSeedRow> Records { get; } =
    [
        new(6, new DateTime(2026, 10, 1), "Equipment & Supplies", "OPEX", "New Desktop PC", 1m, "PC", null, 15000m, "Cash", null),
        new(7, new DateTime(2026, 10, 3), "Meat / Main Products", "COGS", "Chicken", 45m, "pcs", null, 8956m, "Gcash", null),
        new(8, new DateTime(2026, 10, 4), "Equipment & Supplies", "OPEX", "Lechon Belly Box", 5m, null, null, 1328m, "Cash", "Shopee"),
        new(9, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Tubig", null, null, null, 125m, "Cash", null),
        new(10, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Basura", null, null, null, 100m, "Cash", null),
        new(11, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Bigas", null, null, null, 1260m, "Cash", null),
        new(12, new DateTime(2026, 10, 1), "Marketing", "OPEX", "Print", null, null, null, 200m, "Cash", null),
        new(13, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Talbos ng kamote", null, null, null, 40m, "Cash", null),
        new(14, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Pamasahe", null, null, null, 70m, "Cash", null),
        new(15, new DateTime(2026, 10, 1), "Labor", "OPEX", "Bale Kuya Lito", null, null, null, 500m, "Cash", null),
        new(16, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Kikiam", null, null, null, 150m, "Cash", null),
        new(17, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Squid Ball", null, null, null, 150m, "Cash", null),
        new(18, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 210m, "Cash", null),
        new(19, new DateTime(2026, 10, 1), "Staff Meal", "OPEX", "Talong", null, null, null, 64m, "Cash", null),
        new(20, new DateTime(2026, 10, 1), "Staff Meal", "OPEX", "Luya", null, null, null, 152m, "Cash", null),
        new(21, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 49m, "Cash", null),
        new(22, new DateTime(2026, 10, 1), "Staff Meal", "OPEX", "Kamatis", null, null, null, 28m, "Cash", null),
        new(23, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Kulang", null, null, null, 50m, "Cash", null),
        new(24, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Panigang", null, null, null, 280m, "Cash", null),
        new(25, new DateTime(2026, 10, 1), "Equipment & Supplies", "OPEX", "Uling", 23m, "sacks", null, 6740m, "Cash", null),
        new(26, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 280m, "Cash", null),
        new(27, new DateTime(2026, 10, 2), "Equipment & Supplies", "OPEX", "Gasolina", null, null, null, 500m, "Cash", null),
        new(28, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "Mineral Tubig", null, null, null, 120m, "Cash", null),
        new(29, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 69m, "Cash", null),
        new(30, new DateTime(2026, 10, 2), "Equipment & Supplies", "OPEX", "Gasolina", null, null, null, 200m, "Cash", null),
        new(31, new DateTime(2026, 10, 2), "Equipment & Supplies", "OPEX", "Binan", null, null, null, 12160m, "Cash", null),
        new(32, new DateTime(2026, 10, 2), "Equipment & Supplies", "OPEX", "Manpower", null, null, null, 300m, "Cash", null),
        new(33, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "Kikiam", null, null, null, 75m, "Cash", null),
        new(34, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "SQB", null, null, null, 300m, "Cash", null),
        new(35, new DateTime(2026, 10, 2), "Ingredients & Freebies", "COGS", "Coke 1.5L", null, null, null, 3660m, "Cash", null),
        new(36, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Sibuyas", null, null, null, 3400m, "Cash", null),
        new(37, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Bawang", null, null, null, 3710m, "Cash", null),
        new(38, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Sili", null, null, null, 220m, "Cash", null),
        new(39, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 110m, "Cash", null),
        new(40, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 650m, "Cash", null),
        new(41, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 320m, "Cash", null),
        new(42, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Pipino", null, null, null, 100m, "Cash", null),
        new(43, new DateTime(2026, 10, 1), "Ingredients & Freebies", "COGS", "Mantika", null, null, null, 3300m, "Cash", null),
        new(44, new DateTime(2026, 10, 1), "Others", "OPEX", "Pamasahe", null, null, null, 350m, "Cash", null),
        new(45, new DateTime(2026, 10, 1), "Others", "OPEX", "Abono", null, null, null, 660m, "Cash", null),
        new(46, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Francing", null, null, null, 260m, "Cash", null),
        new(47, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 350m, "Cash", null),
        new(48, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Tubig", null, null, null, 125m, "Cash", null),
        new(49, new DateTime(2026, 10, 4), "Labor", "OPEX", "Joener", null, null, null, 20m, "Cash", null),
        new(50, new DateTime(2026, 10, 4), "Fuel", "OPEX", "Gasolina", null, null, null, 150m, "Cash", null),
        new(51, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Siling green", null, null, null, 110m, "Cash", null),
        new(52, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Panigang", null, null, null, 190m, "Cash", null),
        new(53, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "S Onion", null, null, null, 6m, "Cash", null),
        new(54, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Kamatis", null, null, null, 27m, "Cash", null),
        new(55, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Tuyo", null, null, null, 111m, "Cash", null),
        new(56, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Francing", null, null, null, 312m, "Cash", null),
        new(57, new DateTime(2026, 10, 4), "Others", "OPEX", "Pamasahe", null, null, null, 50m, "Cash", null),
        new(58, new DateTime(2026, 10, 4), "Others", "OPEX", "Print", null, null, null, 150m, "Cash", null),
        new(59, new DateTime(2026, 10, 4), "Ingredients & Freebies", "COGS", "Bigas", null, null, null, 150m, "Cash", null),
        new(60, new DateTime(2026, 10, 4), "Others", "OPEX", "Paluwagan", null, null, null, 3500m, "Cash", null),
        new(61, new DateTime(2026, 10, 4), "Equipment & Supplies", "OPEX", "Roated Chicken Bag", null, null, null, 405m, "Cash", "Shopee"),
        new(62, new DateTime(2026, 10, 6), "Equipment & Supplies", "OPEX", "Water Gallon ", 5m, "pcs", null, 1202m, "Cash", "Shopee"),
        new(63, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Star Anise", 5m, "pcs", null, 440m, "Cash", "Shopee"),
        new(64, new DateTime(2026, 10, 7), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 757m, "Cash", "Shopee"),
        new(65, new DateTime(2026, 10, 7), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 857m, "Cash", "Shopee"),
        new(66, new DateTime(2026, 10, 7), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 877m, "Cash", "Shopee"),
        new(67, new DateTime(2026, 10, 7), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 838m, "Cash", "Shopee"),
        new(68, new DateTime(2026, 10, 6), "Equipment & Supplies", "OPEX", "LPG", 5m, "pcs", 1180m, 5900m, "Cash", null),
        new(69, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Dahon na Mura", null, null, null, 72m, "Cash", null),
        new(70, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Bigas", null, null, null, 120m, "Cash", null),
        new(71, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Talong Kamatis Talbos", null, null, null, 93m, "Cash", null),
        new(72, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Print", null, null, null, 60m, "Cash", null),
        new(73, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 200m, "Cash", null),
        new(74, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 160m, "Cash", null),
        new(75, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 100m, "Cash", null),
        new(76, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 119m, "Cash", null),
        new(77, new DateTime(2026, 10, 6), "Ingredients & Freebies", "COGS", "TUbig", null, null, null, 100m, "Cash", null),
        new(78, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Black Pepper", null, null, null, 415m, "Cash", "Shopee"),
        new(79, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Rice", 4m, "sacks", null, 4890m, "Gcash", null),
        new(80, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Basura", null, null, null, 100m, "Cash", null),
        new(81, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Osave", null, null, null, 336m, "Cash", null),
        new(82, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Sili green", null, null, null, 183m, "Cash", null),
        new(83, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Sitaw", null, null, null, 40m, "Cash", null),
        new(84, new DateTime(2026, 10, 8), "Ingredients & Freebies", "COGS", "Bigas", null, null, null, 120m, "Cash", null),
        new(85, new DateTime(2026, 10, 8), "Equipment & Supplies", "OPEX", "Tissue", null, null, null, 57.5m, "Cash", null),
        new(86, new DateTime(2026, 10, 8), "Staff Meal", "OPEX", "Coffee", null, null, null, 170m, "Cash", null),
        new(87, new DateTime(2026, 10, 8), "Staff Meal", "OPEX", "Coco Mama Gata", null, null, null, 68m, "Cash", null),
        new(88, new DateTime(2026, 10, 8), "Equipment & Supplies", "OPEX", "Baygon", null, null, null, 41m, "Cash", null),
        new(89, new DateTime(2026, 10, 8), "Equipment & Supplies", "OPEX", "Paper Plate", 15m, "by 24 pcs", null, 2465m, "Cash", "Shopee"),
        new(90, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Welding Machine", null, null, null, 3147m, "Cash", "Shopee"),
        new(91, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Basahan", null, null, null, 1080m, "Cash", null),
        new(92, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Cobra", null, null, null, 66m, "Cash", null),
        new(93, new DateTime(2026, 10, 9), "Fuel", "OPEX", "Gasolina kuya lito", null, null, null, 200m, "Cash", null),
        new(94, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(95, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Bawang", 6m, "sacks", null, 3060m, "Cash", null),
        new(96, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Sibuyas", 4m, "sacks", null, 3480m, "Cash", null),
        new(97, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 80m, "Cash", null),
        new(98, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Luya", null, null, null, 60m, "Cash", null),
        new(99, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 350m, "Cash", null),
        new(100, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Hasaan", null, null, null, 16m, "Cash", null),
        new(101, new DateTime(2026, 10, 9), "Others", "OPEX", "Pamsahe", null, null, null, 350m, "Cash", null),
        new(102, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Panigang", null, null, null, 374m, "Cash", null),
        new(103, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "S. Onion", null, null, null, 60m, "Cash", null),
        new(104, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Kinchay", null, null, null, 20m, "Cash", null),
        new(105, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 194m, "Cash", null),
        new(106, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Canteen", null, null, null, 520m, "Cash", null),
        new(107, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Sibuyas", 1m, "sacks", null, 920m, "Cash", null),
        new(108, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(109, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Suka", null, null, null, 208m, "Cash", null),
        new(110, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Coffee", null, null, null, 132m, "Cash", null),
        new(111, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Kalamansi Juice Tang", null, null, null, 190m, "Cash", null),
        new(112, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Dalandan Juice Tang", null, null, null, 115.5m, "Cash", null),
        new(113, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Tablea", null, null, null, 69m, "Cash", null),
        new(114, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Potato Chips", null, null, null, 59m, "Cash", null),
        new(115, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "Vitamilk", null, null, null, 59m, "Cash", null),
        new(116, new DateTime(2026, 10, 9), "Staff Meal", "OPEX", "GrandCafe", null, null, null, 36m, "Cash", null),
        new(117, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Hotdog Jumbo", null, null, null, 1700m, "Cash", null),
        new(118, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Evap Creamer", null, null, null, 1380m, "Cash", null),
        new(119, new DateTime(2026, 10, 9), "Ingredients & Freebies", "COGS", "Condense Creamer", null, null, null, 3624m, "Cash", null),
        new(120, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Paper Plate", null, null, null, 1050m, "Cash", null),
        new(121, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Plastic 12x18", null, null, null, 420m, "Cash", null),
        new(122, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Plastic 14x20", null, null, null, 630m, "Cash", null),
        new(123, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Plastic 260", null, null, null, 100m, "Cash", null),
        new(124, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Plastic 20x30", null, null, null, 180m, "Cash", null),
        new(125, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Ethernet Cable", null, null, null, 829m, "Cash", "Shopee"),
        new(126, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Monitor Stand", null, null, null, 477m, "Cash", "Shopee"),
        new(127, new DateTime(2026, 10, 9), "Equipment & Supplies", "OPEX", "Receipt Paper", 10m, "pcs", 86m, 760m, "Cash", "Shopee"),
        new(128, new DateTime(2026, 10, 10), "Equipment & Supplies", "OPEX", "tubig", 5m, "pcs", null, 125m, "Cash", null),
        new(129, new DateTime(2026, 10, 10), "Labor", "OPEX", "Manpower", null, null, null, 450m, "Cash", null),
        new(130, new DateTime(2026, 10, 10), "Equipment & Supplies", "OPEX", "Print", null, null, null, 300m, "Cash", null),
        new(131, new DateTime(2026, 10, 10), "Staff Meal", "OPEX", "Luya", null, null, null, 91m, "Cash", null),
        new(132, new DateTime(2026, 10, 10), "Ingredients & Freebies", "COGS", "Calamansi", null, null, null, 34m, "Cash", null),
        new(133, new DateTime(2026, 10, 10), "Staff Meal", "OPEX", "Okra", null, null, null, 16m, "Cash", null),
        new(134, new DateTime(2026, 10, 10), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 196m, "Cash", null),
        new(135, new DateTime(2026, 10, 10), "Staff Meal", "OPEX", "Panigang", null, null, null, 251m, "Cash", null),
        new(136, new DateTime(2026, 10, 10), "Staff Meal", "OPEX", "Tuyo", null, null, null, 137m, "Cash", null),
        new(137, new DateTime(2026, 10, 10), "Staff Meal", "OPEX", "Pakbet", null, null, null, 60m, "Cash", null),
        new(138, new DateTime(2026, 10, 10), "Ingredients & Freebies", "COGS", "Canton", null, null, null, 2600m, "Cash", null),
        new(139, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Manila Paper", 20m, "pcs", null, 1149m, "Cash", "Shopee"),
        new(140, new DateTime(2026, 10, 11), "Ingredients & Freebies", "COGS", "Tita Elay ", null, null, null, 8360m, "Cash", null),
        new(141, new DateTime(2026, 10, 11), "Ingredients & Freebies", "COGS", "Kikiam", null, null, null, 300m, "Cash", null),
        new(142, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Canister", null, null, null, 720m, "Cash", null),
        new(143, new DateTime(2026, 10, 11), "Others", "OPEX", "Paluwagan", null, null, null, 3500m, "Cash", null),
        new(144, new DateTime(2026, 10, 11), "Ingredients & Freebies", "COGS", "Tubig", null, null, null, 100m, "Cash", null),
        new(145, new DateTime(2026, 10, 11), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 244m, "Cash", null),
        new(146, new DateTime(2026, 10, 11), "Staff Meal", "OPEX", "Talong", null, null, null, 26m, "Cash", null),
        new(147, new DateTime(2026, 10, 11), "Staff Meal", "OPEX", "Kamatis", null, null, null, 15m, "Cash", null),
        new(148, new DateTime(2026, 10, 11), "Staff Meal", "OPEX", "kangkong", null, null, null, 30m, "Cash", null),
        new(149, new DateTime(2026, 10, 11), "Staff Meal", "OPEX", "Panigang", null, null, null, 189m, "Cash", null),
        new(150, new DateTime(2026, 10, 11), "Meat / Main Products", "COGS", "Belly", null, null, null, 16731m, "Gcash", null),
        new(151, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 822m, "Cash", "Shopee"),
        new(152, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 842m, "Cash", "Shopee"),
        new(153, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 803m, "Cash", "Shopee"),
        new(154, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Plastic Bilao", 5m, "pcs", null, 756m, "Cash", "Shopee"),
        new(155, new DateTime(2026, 10, 11), "Equipment & Supplies", "OPEX", "Macrame 12ply", 10m, "pcs", 175m, 1522m, "Cash", "Shopee"),
        new(156, new DateTime(2026, 10, 13), "Equipment & Supplies", "OPEX", "Canister", null, null, null, 1600m, "Cash", null),
        new(157, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 210m, "Cash", null),
        new(158, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 118m, "Cash", null),
        new(159, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "SQB and Kikiam", null, null, null, 150m, "Cash", null),
        new(160, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Quezo", null, null, null, 360m, "Cash", null),
        new(161, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 250m, "Cash", null),
        new(162, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "OK small (palengke)", 50m, "pcs", null, 2400m, "Cash", null),
        new(163, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 53m, "Cash", null),
        new(164, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Pakbet", null, null, null, 98m, "Cash", null),
        new(165, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Kamatis", null, null, null, 28m, "Cash", null),
        new(166, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Calamansi", null, null, null, 16m, "Cash", null),
        new(167, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 46m, "Cash", null),
        new(168, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Okra", null, null, null, 24m, "Cash", null),
        new(169, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "S. Onion", null, null, null, 35m, "Cash", null),
        new(170, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Luya", null, null, null, 122m, "Cash", null),
        new(171, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Tinapa", null, null, null, 66m, "Cash", null),
        new(172, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "SQB and Kikiam", null, null, null, 360m, "Cash", null),
        new(173, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Francing", null, null, null, 702m, "Cash", null),
        new(174, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Print", null, null, null, 60m, "Cash", null),
        new(175, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Isda", null, null, null, 68m, "Cash", null),
        new(176, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Basura", null, null, null, 100m, "Cash", null),
        new(177, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(178, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Tubig", null, null, null, 175m, "Cash", null),
        new(179, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Shure 750ml box", null, null, null, 6200m, "Cash", null),
        new(180, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Hotdog Jumbo", null, null, null, 1955m, "Cash", null),
        new(181, new DateTime(2026, 10, 13), "Ingredients & Freebies", "COGS", "Pasta Spag", null, null, null, 2595m, "Cash", null),
        new(182, new DateTime(2026, 10, 16), "Ingredients & Freebies", "COGS", "Sili", null, null, null, 148m, "Cash", null),
        new(183, new DateTime(2026, 10, 16), "Equipment & Supplies", "OPEX", "Lazada", null, null, null, 372m, "Cash", null),
        new(184, new DateTime(2026, 10, 16), "Ingredients & Freebies", "COGS", "Bawang", 7m, "sacks", null, 3640m, "Cash", null),
        new(185, new DateTime(2026, 10, 16), "Ingredients & Freebies", "COGS", "Sibuyas", 3m, "sacks", null, 2100m, "Cash", null),
        new(186, new DateTime(2026, 10, 16), "Ingredients & Freebies", "COGS", "Asin", 3m, "sacks", null, 900m, "Cash", null),
        new(187, new DateTime(2026, 10, 16), "Ingredients & Freebies", "COGS", "Mantika", 2m, null, null, 3300m, "Cash", null),
        new(188, new DateTime(2026, 10, 16), "Equipment & Supplies", "OPEX", "Kalan", null, null, null, 400m, "Cash", null),
        new(189, new DateTime(2026, 10, 16), "Others", "OPEX", "Pamasahe", null, null, null, 350m, "Cash", null),
        new(190, new DateTime(2026, 10, 17), "Equipment & Supplies", "OPEX", "Bar Powder", null, null, null, 77m, "Cash", null),
        new(191, new DateTime(2026, 10, 17), "Equipment & Supplies", "OPEX", "Eco Bag", null, null, null, 108m, "Cash", null),
        new(192, new DateTime(2026, 10, 17), "Others", "OPEX", "Pamasahe", null, null, null, 50m, "Cash", null),
        new(193, new DateTime(2026, 10, 17), "Equipment & Supplies", "OPEX", "Logo", null, null, null, 300m, "Cash", null),
        new(194, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "1.5 Coke", null, null, null, 160m, "Cash", null),
        new(195, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "tanglad", null, null, null, 150m, "Cash", null),
        new(196, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Coke", null, null, null, 3660m, "Cash", null),
        new(197, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "SQB Kikiam", null, null, null, 600m, "Cash", null),
        new(198, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "C.gang", null, null, null, 196m, "Cash", null),
        new(199, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "S. Onion", null, null, null, 45m, "Cash", null),
        new(200, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 42m, "Cash", null),
        new(201, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Palabok", null, null, null, 3750m, "Cash", null),
        new(202, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Bihon", null, null, null, 3750m, "Cash", null),
        new(203, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 231m, "Cash", null),
        new(204, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Kamatis", null, null, null, 25m, "Cash", null),
        new(205, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Ampalaya", null, null, null, 31m, "Cash", null),
        new(206, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Cgang", null, null, null, 183m, "Cash", null),
        new(207, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Canton", null, null, null, 2600m, "Cash", null),
        new(208, new DateTime(2026, 10, 18), "Others", "OPEX", "Paluwagan", null, null, null, 3500m, "Cash", null),
        new(209, new DateTime(2026, 10, 17), "Staff Meal", "OPEX", "Panigang", null, null, null, 106m, "Cash", null),
        new(210, new DateTime(2026, 10, 17), "Staff Meal", "OPEX", "Lansones", null, null, null, 101m, "Cash", null),
        new(211, new DateTime(2026, 10, 17), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 62m, "Cash", null),
        new(212, new DateTime(2026, 10, 17), "Staff Meal", "OPEX", "Saba", null, null, null, 43m, "Cash", null),
        new(213, new DateTime(2026, 10, 17), "Staff Meal", "OPEX", "Luya", null, null, null, 152m, "Cash", null),
        new(214, new DateTime(2026, 10, 18), "Ingredients & Freebies", "COGS", "Patatas & Bell Pepper", null, null, null, 165m, "Cash", null),
        new(215, new DateTime(2026, 10, 18), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 150m, "Cash", null),
        new(216, new DateTime(2026, 10, 18), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 58m, "Cash", null),
        new(217, new DateTime(2026, 10, 18), "Ingredients & Freebies", "COGS", "Tita Elay", null, null, null, 7000m, "Gcash", null),
        new(218, new DateTime(2026, 10, 18), "Equipment & Supplies", "OPEX", "Uling", null, null, null, 84000m, "Gcash", null),
        new(219, new DateTime(2026, 10, 19), "Ingredients & Freebies", "COGS", "Rice", 4m, "sacks", null, 4890m, "Gcash", null),
        new(220, new DateTime(2026, 10, 20), "Others", "OPEX", "Abono sa Bangkulong", null, null, null, 1000m, "Cash", null),
        new(221, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Lumpia Wrapper", null, null, null, 60m, "Cash", null),
        new(222, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Kinchay", null, null, null, 58m, "Cash", null),
        new(223, new DateTime(2026, 10, 20), "Staff Meal", "OPEX", "Pakbet", null, null, null, 100m, "Cash", null),
        new(224, new DateTime(2026, 10, 20), "Staff Meal", "OPEX", "Upo", null, null, null, 60m, "Cash", null),
        new(225, new DateTime(2026, 10, 20), "Others", "OPEX", "Bangkulong Repair", null, null, null, 3000m, "Cash", null),
        new(226, new DateTime(2026, 10, 20), "Fuel", "OPEX", "Gasolina", null, null, null, 250m, "Cash", null),
        new(227, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Harina", null, null, null, 65m, "Cash", null),
        new(228, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Aswete", null, null, null, 50m, "Cash", null),
        new(229, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Harina2", null, null, null, 50m, "Cash", null),
        new(230, new DateTime(2026, 10, 20), "Labor", "OPEX", "Manpower", null, null, null, 500m, "Cash", null),
        new(231, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Blueberry Frozen", null, null, null, 488.25m, "Cash", null),
        new(232, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "mixed Cut-ups", null, null, null, 75m, "Cash", null),
        new(233, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Dressed Chicken", null, null, null, 175m, "Cash", null),
        new(234, new DateTime(2026, 10, 20), "Ingredients & Freebies", "COGS", "Crimson Grapes", null, null, null, 89.75m, "Cash", null),
        new(235, new DateTime(2026, 10, 19), "Meat / Main Products", "COGS", "Belly", null, null, null, 13950m, "Gcash", null),
        new(236, new DateTime(2026, 10, 23), "Marketing", "OPEX", "FB Ads", null, null, null, 20000m, "Gcash", null),
        new(237, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "Puregold", null, null, null, 13676m, "Cash", null),
        new(238, new DateTime(2026, 10, 25), "Ingredients & Freebies", "COGS", "Queso and Coke", null, null, null, 7000m, "Cash", null),
        new(239, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Sibuyas", null, null, null, 2640m, "Cash", null),
        new(240, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Bawang", null, null, null, 4000m, "Cash", null),
        new(241, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Sili", null, null, null, 275m, "Cash", null),
        new(242, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 370m, "Cash", null),
        new(243, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 14m, "Cash", null),
        new(244, new DateTime(2026, 10, 23), "Ingredients & Freebies", "COGS", "Asin", null, null, null, 300m, "Cash", null),
        new(245, new DateTime(2026, 10, 23), "Others", "OPEX", "Pamasahe", null, null, null, 350m, "Cash", null),
        new(246, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(247, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "Kikiam and SQB", null, null, null, 150m, "Cash", null),
        new(248, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 167m, "Cash", null),
        new(249, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "Cgang", null, null, null, 114m, "Cash", null),
        new(250, new DateTime(2026, 10, 21), "Ingredients & Freebies", "COGS", "S.Onion", null, null, null, 21m, "Cash", null),
        new(251, new DateTime(2026, 10, 22), "Equipment & Supplies", "OPEX", "Print", null, null, null, 300m, "Cash", null),
        new(252, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Sili", null, null, null, 120m, "Cash", null),
        new(253, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 258m, "Cash", null),
        new(254, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 128m, "Cash", null),
        new(255, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Kikiam and SB", null, null, null, 450m, "Cash", null),
        new(256, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(257, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "osave", null, null, null, 6024m, "Cash", null),
        new(258, new DateTime(2026, 10, 22), "Fuel", "OPEX", "Gasolina", null, null, null, 105m, "Cash", null),
        new(259, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 289m, "Cash", null),
        new(260, new DateTime(2026, 10, 22), "Staff Meal", "OPEX", "Munggo", null, null, null, 130m, "Cash", null),
        new(261, new DateTime(2026, 10, 22), "Staff Meal", "OPEX", "Tuyo", null, null, null, 132m, "Cash", null),
        new(262, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 57m, "Cash", null),
        new(263, new DateTime(2026, 10, 22), "Ingredients & Freebies", "COGS", "Kamatis", null, null, null, 48m, "Cash", null),
        new(264, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "S. Onion", null, null, null, 88m, "Cash", null),
        new(265, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "Evam Creamer", null, null, null, 1380m, "Cash", null),
        new(266, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "Condense Creamer", null, null, null, 3624m, "Cash", null),
        new(267, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "Hotdog Jumbo", null, null, null, 1020m, "Cash", null),
        new(268, new DateTime(2026, 10, 24), "Meat / Main Products", "COGS", "Belly", null, null, null, 10366m, "Gcash", null),
        new(269, new DateTime(2026, 10, 24), "Fuel", "OPEX", "Gasolina", null, null, null, 200m, "Cash", null),
        new(270, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
        new(271, new DateTime(2026, 10, 24), "Equipment & Supplies", "OPEX", "Sabon", null, null, null, 155m, "Cash", null),
        new(272, new DateTime(2026, 10, 24), "Equipment & Supplies", "OPEX", "Print", null, null, null, 100m, "Cash", null),
        new(273, new DateTime(2026, 10, 24), "Equipment & Supplies", "OPEX", "c/o toto gulong", null, null, null, 950m, "Cash", null),
        new(274, new DateTime(2026, 10, 24), "Equipment & Supplies", "OPEX", "C/o bossing", null, null, null, 20000m, "Cash", null),
        new(275, new DateTime(2026, 10, 24), "Others", "OPEX", "paluwagan", null, null, null, 3500m, "Cash", null),
        new(276, new DateTime(2026, 10, 24), "Others", "OPEX", "c/o Nelia", null, null, null, 300m, "Cash", null),
        new(277, new DateTime(2026, 10, 24), "Equipment & Supplies", "OPEX", "Abeth", null, null, null, 900m, "Cash", null),
        new(278, new DateTime(2026, 10, 24), "Ingredients & Freebies", "COGS", "Siling green c/o ate cora", null, null, null, 210m, "Cash", null),
        new(279, new DateTime(2026, 10, 24), "Staff Meal", "OPEX", "Mango Royal", null, null, null, 99m, "Cash", null),
        new(280, new DateTime(2026, 10, 25), "Staff Meal", "OPEX", "Panigang", null, null, null, 207m, "Cash", null),
        new(281, new DateTime(2026, 10, 25), "Staff Meal", "OPEX", "Ampalaya", null, null, null, 80m, "Cash", null),
        new(282, new DateTime(2026, 10, 25), "Ingredients & Freebies", "COGS", "From Tita Elay", null, null, null, 6000m, "Cash", null),
        new(283, new DateTime(2026, 10, 11), "Labor", "OPEX", "Matt 2 days", null, null, null, 1250m, "Cash", null),
        new(284, new DateTime(2026, 10, 11), "Labor", "OPEX", "Gian 2 days", null, null, null, 1000m, "Cash", null),
        new(285, new DateTime(2026, 10, 11), "Labor", "OPEX", "Angelo 2 days", null, null, null, 1150m, "Cash", null),
        new(286, new DateTime(2026, 10, 11), "Labor", "OPEX", "Abu 5 days", null, null, null, 2800m, "Cash", null),
        new(287, new DateTime(2026, 10, 11), "Labor", "OPEX", "Francis 4 days", null, null, null, 2000m, "Cash", null),
        new(288, new DateTime(2026, 10, 11), "Labor", "OPEX", "Ate Baby", null, null, null, 1700m, "Cash", null),
        new(289, new DateTime(2026, 10, 11), "Labor", "OPEX", "Kuya Lito", null, null, null, 2500m, "Cash", null),
        new(290, new DateTime(2026, 10, 18), "Labor", "OPEX", "Payroll", null, null, null, 68290m, "Cash", null),
        new(291, new DateTime(2026, 10, 25), "Labor", "OPEX", "Payroll", null, null, null, 69610m, "Cash", null),
        new(292, new DateTime(2026, 10, 28), "Equipment & Supplies", "OPEX", "Plastic Bilao", 10m, "pcs", null, 710m, "Cash", "Shopee"),
        new(293, new DateTime(2026, 10, 28), "Equipment & Supplies", "OPEX", "Macrame 12ply", null, null, null, 2784m, "Cash", "Shopee"),
        new(294, new DateTime(2026, 10, 28), "Equipment & Supplies", "OPEX", "Tanglad", null, null, null, 250m, "Cash", null),
        new(295, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Peanut; Pickes; Pasas", null, null, null, 90m, "Cash", null),
        new(296, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Onion", null, null, null, 46m, "Cash", null),
        new(297, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Coffee", null, null, null, 136m, "Cash", null),
        new(298, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Tomato paste", null, null, null, 11m, "Cash", null),
        new(299, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Liver Spread", null, null, null, 43m, "Cash", null),
        new(300, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Knorr Cubes", null, null, null, 24m, "Cash", null),
        new(301, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Green Peas", null, null, null, 11.75m, "Cash", null),
        new(302, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 369m, "Cash", null),
        new(303, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 224m, "Cash", null),
        new(304, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Panigang", null, null, null, 118m, "Cash", null),
        new(305, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Labuyo", null, null, null, 45m, "Cash", null),
        new(306, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 46m, "Cash", null),
        new(307, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Calamansi", null, null, null, 43m, "Cash", null),
        new(308, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Patatas", null, null, null, 17m, "Cash", null),
        new(309, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Bell Pepper", null, null, null, 48m, "Cash", null),
        new(310, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Onion", null, null, null, 46m, "Cash", null),
        new(311, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Sibuyas", null, null, null, 3250m, "Cash", null),
        new(312, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Bawang", null, null, null, 5100m, "Cash", null),
        new(313, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Carrots", null, null, null, 420m, "Cash", null),
        new(314, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Repolyo", null, null, null, 530m, "Cash", null),
        new(315, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Sili", null, null, null, 285m, "Cash", null),
        new(316, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Beans", null, null, null, 210m, "Cash", null),
        new(317, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Sayote", null, null, null, 115m, "Cash", null),
        new(318, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Mantika", null, null, null, 1650m, "Cash", null),
        new(319, new DateTime(2026, 10, 28), "Others", "OPEX", "Pamasahe at prutas", null, null, null, 628m, "Cash", null),
        new(320, new DateTime(2026, 10, 28), "Staff Meal", "OPEX", "Bigas", 5m, "sacks", null, 5800m, "Cash", null),
        new(321, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Catsup", null, null, null, 425m, "Cash", null),
        new(322, new DateTime(2026, 10, 28), "Ingredients & Freebies", "COGS", "Ok Chesse", null, null, null, 500m, "Cash", null),
        new(323, new DateTime(2026, 10, 28), "Equipment & Supplies", "OPEX", "Sealant", null, null, null, 150m, "Cash", null),
        new(324, new DateTime(2026, 10, 29), "Ingredients & Freebies", "COGS", "Brown Sugar", null, null, null, 6400m, "Cash", null),
        new(325, new DateTime(2026, 10, 29), "Ingredients & Freebies", "COGS", "10x14 plastic", null, null, null, 500m, "Cash", null),
        new(326, new DateTime(2026, 10, 29), "Ingredients & Freebies", "COGS", "12x18 plastic", null, null, null, 840m, "Cash", null),
        new(327, new DateTime(2026, 10, 29), "Ingredients & Freebies", "COGS", "14x20 plastic", null, null, null, 1260m, "Cash", null),
        new(328, new DateTime(2026, 10, 29), "Ingredients & Freebies", "COGS", "Hotdog Jumbo", null, null, null, 935m, "Cash", null),
        new(329, new DateTime(2026, 10, 30), "Utilities", "OPEX", "Water bill", null, null, null, 6258m, "Gcash", null),
        new(330, new DateTime(2026, 10, 30), "Equipment & Supplies", "OPEX", "Logo print", null, null, null, 300m, "Cash", null),
        new(331, new DateTime(2026, 10, 30), "Fuel", "OPEX", "Gasolina", null, null, null, 200m, "Cash", null),
        new(332, new DateTime(2026, 10, 30), "Equipment & Supplies", "OPEX", "Uling Bale", null, null, null, 3000m, "Cash", null),
        new(333, new DateTime(2026, 10, 30), "Labor", "OPEX", "Manpower", null, null, null, 600m, "Cash", null),
        new(334, new DateTime(2026, 10, 30), "Ingredients & Freebies", "COGS", "SQB & kikiam", null, null, null, 510m, "Cash", null),
        new(335, new DateTime(2026, 10, 30), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 200m, "Cash", null),
        new(336, new DateTime(2026, 10, 30), "Staff Meal", "OPEX", "Pakbet", null, null, null, 100m, "Cash", null),
        new(337, new DateTime(2026, 10, 30), "Meat / Main Products", "COGS", "Belly", null, null, null, 8582m, "Gcash", null),
        new(338, new DateTime(2026, 10, 31), "Equipment & Supplies", "OPEX", "Print", null, null, null, 20m, "Cash", null),
        new(339, new DateTime(2026, 10, 31), "Ingredients & Freebies", "COGS", "Tubig", null, null, null, 75m, "Cash", null),
        new(340, new DateTime(2026, 10, 31), "Equipment & Supplies", "OPEX", "Print", null, null, null, 20m, "Cash", null),
        new(341, new DateTime(2026, 10, 31), "Equipment & Supplies", "OPEX", "Uling", null, null, null, 19m, "Cash", null),
        new(342, new DateTime(2026, 10, 31), "Ingredients & Freebies", "COGS", "Canton", null, null, null, 560m, "Cash", null),
        new(343, new DateTime(2026, 10, 31), "Ingredients & Freebies", "COGS", "Siling Green", null, null, null, 180m, "Cash", null),
        new(344, new DateTime(2026, 10, 31), "Ingredients & Freebies", "COGS", "Dali", null, null, null, 1235.25m, "Cash", null),
        new(345, new DateTime(2026, 10, 31), "Others", "OPEX", "Paluwagan", null, null, null, 3500m, "Cash", null),
        new(346, new DateTime(2026, 10, 31), "Ingredients & Freebies", "COGS", "Tanglad", null, null, null, 150m, "Cash", null),
    ];

    public static async Task<int> SeedAsync(LechonDbContext context, CancellationToken cancellationToken = default)
    {
        ValidateCompiledLedger();

        var monthStart = new DateTime(2026, 10, 1);
        var monthEnd = new DateTime(2026, 11, 1);
        var unmatchedExistingRows = await context.Expenses
            .Where(expense => expense.ExpenseDate >= monthStart &&
                              expense.ExpenseDate < monthEnd &&
                              expense.EncodedBy == SeededBy)
            .ToListAsync(cancellationToken);

        var inserted = 0;
        foreach (var row in Records)
        {
            // Match one existing occurrence at a time. This deliberately preserves
            // legitimate duplicate spreadsheet rows instead of collapsing them.
            var matchIndex = unmatchedExistingRows.FindIndex(row.Matches);
            if (matchIndex >= 0)
            {
                unmatchedExistingRows.RemoveAt(matchIndex);
                continue;
            }

            context.Expenses.Add(new ExpenseRecord
            {
                ExpenseDate = row.ExpenseDate,
                Category = row.Category,
                CostType = row.CostType,
                ItemDescription = row.ItemDescription,
                Quantity = row.Quantity,
                Unit = row.Unit,
                UnitCost = row.UnitCost,
                TotalCost = row.TotalCost,
                PaymentMethod = row.PaymentMethod,
                Remarks = row.Remarks,
                EncodedBy = SeededBy,
                CreatedAt = new DateTime(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc).AddTicks(row.SourceRow)
            });
            inserted++;
        }

        if (inserted > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        return inserted;
    }

    private static void ValidateCompiledLedger()
    {
        var cogs = Records.Where(row => row.CostType == "COGS").Sum(row => row.TotalCost);
        var opex = Records.Where(row => row.CostType == "OPEX").Sum(row => row.TotalCost);
        var grandTotal = Records.Sum(row => row.TotalCost);

        if (Records.Count != ExpectedRowCount ||
            cogs != ExpectedCogsTotal ||
            opex != ExpectedOpexTotal ||
            grandTotal != ExpectedGrandTotal)
        {
            throw new InvalidOperationException(
                $"October expense seed integrity check failed. Rows={Records.Count}, COGS={cogs}, OPEX={opex}, Total={grandTotal}.");
        }
    }
}

public sealed record October2026ExpenseSeedRow(
    int SourceRow,
    DateTime ExpenseDate,
    string Category,
    string CostType,
    string ItemDescription,
    decimal? Quantity,
    string? Unit,
    decimal? UnitCost,
    decimal TotalCost,
    string PaymentMethod,
    string? Remarks)
{
    public bool Matches(ExpenseRecord expense)
    {
        return expense.ExpenseDate.Date == ExpenseDate.Date &&
               expense.Category == Category &&
               expense.CostType == CostType &&
               expense.ItemDescription == ItemDescription &&
               expense.Quantity == Quantity &&
               expense.Unit == Unit &&
               expense.UnitCost == UnitCost &&
               expense.TotalCost == TotalCost &&
               expense.PaymentMethod == PaymentMethod &&
               expense.Remarks == Remarks;
    }
}

