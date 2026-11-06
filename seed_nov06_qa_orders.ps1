param(
    [string]$Server = "localhost\SQLEXPRESS",
    [string]$Database = "LechonSystemDb"
)

$ErrorActionPreference = "Stop"

Write-Host "Connecting to SQL Server ($Server / $Database)..." -ForegroundColor Cyan
$connStr = "Server=$Server;Database=$Database;Trusted_Connection=True;TrustServerCertificate=True;"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
} catch {
    Write-Host "Falling back to Microsoft.Data.SqlClient..." -ForegroundColor Yellow
    $conn = New-Object Microsoft.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
}

Write-Host "Connected successfully!" -ForegroundColor Green

function Get-OrCreateRiderTrip {
    param(
        [string]$riderName,
        [int]$status = 1
    )
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TOP 1 Id FROM DeliveryTrips WHERE RiderName = @rider ORDER BY Id DESC"
    $cmd.Parameters.AddWithValue("@rider", $riderName) | Out-Null
    $tripId = $cmd.ExecuteScalar()

    if ($tripId) {
        return [int]$tripId
    }

    $insCmd = $conn.CreateCommand()
    $insCmd.CommandText = @"
INSERT INTO DeliveryTrips (RiderName, VehicleType, Status, DispatchTime, CreatedAt)
OUTPUT INSERTED.Id
VALUES (@rider, 'Motorcycle', @status, GETUTCDATE(), GETUTCDATE())
"@
    $insCmd.Parameters.AddWithValue("@rider", $riderName) | Out-Null
    $insCmd.Parameters.AddWithValue("@status", $status) | Out-Null
    return [int]$insCmd.ExecuteScalar()
}

function Upsert-CustomerProfile {
    param(
        [string]$phone,
        [string]$name,
        [string]$fbName,
        [string]$address,
        [string]$landmark,
        [string]$preferences,
        [bool]$isVip
    )
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT Id FROM CustomerProfiles WHERE ContactNumber = @phone"
    $cmd.Parameters.AddWithValue("@phone", $phone) | Out-Null
    $profileId = $cmd.ExecuteScalar()

    if ($profileId) {
        $upd = $conn.CreateCommand()
        $upd.CommandText = @"
UPDATE CustomerProfiles SET
    FullName = @name,
    FacebookName = @fbName,
    DefaultAddress = @address,
    DefaultLandmark = @landmark,
    Preferences = @preferences,
    IsVip = @isVip,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $upd.Parameters.AddWithValue("@id", [int]$profileId) | Out-Null
        $upd.Parameters.AddWithValue("@name", $name) | Out-Null
        $upd.Parameters.AddWithValue("@fbName", $(if ($fbName) { $fbName } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@address", $(if ($address) { $address } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@landmark", $(if ($landmark) { $landmark } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@preferences", $(if ($preferences) { $preferences } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@isVip", $isVip) | Out-Null
        $upd.ExecuteNonQuery() | Out-Null
    } else {
        $ins = $conn.CreateCommand()
        $ins.CommandText = @"
INSERT INTO CustomerProfiles (
    ContactNumber, FullName, FacebookName, DefaultAddress, DefaultLandmark,
    Preferences, ComplaintHistory, IsVip, TotalOrdersCount, CreatedAt, UpdatedAt
) VALUES (
    @phone, @name, @fbName, @address, @landmark,
    @preferences, NULL, @isVip, 1, GETUTCDATE(), GETUTCDATE()
)
"@
        $ins.Parameters.AddWithValue("@phone", $phone) | Out-Null
        $ins.Parameters.AddWithValue("@name", $name) | Out-Null
        $ins.Parameters.AddWithValue("@fbName", $(if ($fbName) { $fbName } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@address", $(if ($address) { $address } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@landmark", $(if ($landmark) { $landmark } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@preferences", $(if ($preferences) { $preferences } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@isVip", $isVip) | Out-Null
        $ins.ExecuteNonQuery() | Out-Null
    }
}

function Upsert-FullQaOrder {
    param(
        [hashtable]$OrderData
    )

    $ref = $OrderData.OrderReference
    Write-Host "`n--------------------------------------------------" -ForegroundColor Cyan
    Write-Host "Upserting Order $ref ($($OrderData.CustomerName))..." -ForegroundColor Cyan

    # 1. Resolve DeliveryTrip
    $tripId = $null
    if ($OrderData.AssignedRider) {
        $tripStatus = if ($OrderData.RoutingStatus) { $OrderData.RoutingStatus } else { 1 }
        $tripId = Get-OrCreateRiderTrip -riderName $OrderData.AssignedRider -status $tripStatus
        Write-Host "  Rider trip: $($OrderData.AssignedRider) (TripId: $tripId)" -ForegroundColor DarkGray
    }

    # 2. Check Order existence
    $checkCmd = $conn.CreateCommand()
    $checkCmd.CommandText = "SELECT Id FROM Orders WHERE OrderReference = @ref"
    $checkCmd.Parameters.AddWithValue("@ref", $ref) | Out-Null
    $orderId = $checkCmd.ExecuteScalar()

    if ($orderId) {
        $orderId = [int]$orderId
        Write-Host "  Found existing Order #$ref (ID: $orderId). Updating..." -ForegroundColor Yellow
        $upd = $conn.CreateCommand()
        $upd.CommandText = @"
UPDATE Orders SET
    CustomerName = @customerName,
    FacebookName = @fbName,
    ContactNumber = @phone,
    Source = @source,
    Fulfillment = @fulfillment,
    TargetDeliveryTime = @targetTime,
    RiderDepartureTime = @depTime,
    IsTimeTbd = 0,
    IsDraft = 0,
    IsDeliveryDetailsConfirmed = 1,
    IsCancelled = 0,
    IsPriceWaived = 0,
    IsOwnerConfirmed = 1,
    DeliveryAddress = @address,
    Landmark = @landmark,
    Remarks = @remarks,
    Price = @price,
    DeliveryFee = @deliveryFee,
    Downpayment = @downpayment,
    DownpaymentMethod = @dpMethod,
    GrandTotal = @grandTotal,
    Discount = 0,
    IsTrustedCustomer = @isTrusted,
    SettlementCustodyStatus = @custodyStatus,
    RoutingStatus = @routingStatus,
    DeliveryTripId = @tripId,
    FreebiesSummary = @freebiesSummary,
    FreebiesConfigJson = @freebiesJson,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $upd.Parameters.AddWithValue("@id", $orderId) | Out-Null
        $upd.Parameters.AddWithValue("@customerName", $OrderData.CustomerName) | Out-Null
        $upd.Parameters.AddWithValue("@fbName", $(if ($OrderData.FacebookName) { $OrderData.FacebookName } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@phone", $OrderData.ContactNumber) | Out-Null
        $upd.Parameters.AddWithValue("@source", $OrderData.Source) | Out-Null
        $upd.Parameters.AddWithValue("@fulfillment", [int]$OrderData.Fulfillment) | Out-Null
        $upd.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $upd.Parameters.AddWithValue("@depTime", [datetime]$OrderData.RiderDepartureTime) | Out-Null
        $upd.Parameters.AddWithValue("@address", $(if ($OrderData.DeliveryAddress) { $OrderData.DeliveryAddress } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@landmark", $(if ($OrderData.Landmark) { $OrderData.Landmark } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@remarks", $(if ($OrderData.Remarks) { $OrderData.Remarks } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $upd.Parameters.AddWithValue("@deliveryFee", [decimal]$OrderData.DeliveryFee) | Out-Null
        $upd.Parameters.AddWithValue("@downpayment", [decimal]$OrderData.Downpayment) | Out-Null
        $upd.Parameters.AddWithValue("@dpMethod", $OrderData.DownpaymentMethod) | Out-Null
        $upd.Parameters.AddWithValue("@grandTotal", [decimal]$OrderData.GrandTotal) | Out-Null
        $upd.Parameters.AddWithValue("@isTrusted", [bool]$OrderData.IsTrustedCustomer) | Out-Null
        $upd.Parameters.AddWithValue("@custodyStatus", $OrderData.SettlementCustodyStatus) | Out-Null
        $upd.Parameters.AddWithValue("@routingStatus", [int]$OrderData.RoutingStatus) | Out-Null
        $upd.Parameters.AddWithValue("@tripId", $(if ($tripId) { [int]$tripId } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@freebiesSummary", $(if ($OrderData.FreebiesSummary) { $OrderData.FreebiesSummary } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@freebiesJson", $(if ($OrderData.FreebiesConfigJson) { $OrderData.FreebiesConfigJson } else { [DBNull]::Value })) | Out-Null
        $upd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "  Inserting new Order #$ref..." -ForegroundColor Green
        $ins = $conn.CreateCommand()
        $ins.CommandText = @"
INSERT INTO Orders (
    OrderReference, CustomerName, FacebookName, ContactNumber, Source,
    Fulfillment, TargetDeliveryTime, RiderDepartureTime, IsTimeTbd, IsDraft,
    IsDeliveryDetailsConfirmed, IsCancelled, IsPriceWaived, IsOwnerConfirmed,
    DeliveryAddress, Landmark, Remarks, Price, DeliveryFee, Downpayment,
    DownpaymentMethod, GrandTotal, Discount, IsTrustedCustomer, SettlementCustodyStatus,
    RoutingStatus, DeliveryTripId, FreebiesSummary, FreebiesConfigJson, CreatedBy, CreatedAt
)
OUTPUT INSERTED.Id
VALUES (
    @ref, @customerName, @fbName, @phone, @source,
    @fulfillment, @targetTime, @depTime, 0, 0,
    1, 0, 0, 1,
    @address, @landmark, @remarks, @price, @deliveryFee, @downpayment,
    @dpMethod, @grandTotal, 0, @isTrusted, @custodyStatus,
    @routingStatus, @tripId, @freebiesSummary, @freebiesJson, 'QA Seed Nov 06', GETUTCDATE()
)
"@
        $ins.Parameters.AddWithValue("@ref", $ref) | Out-Null
        $ins.Parameters.AddWithValue("@customerName", $OrderData.CustomerName) | Out-Null
        $ins.Parameters.AddWithValue("@fbName", $(if ($OrderData.FacebookName) { $OrderData.FacebookName } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@phone", $OrderData.ContactNumber) | Out-Null
        $ins.Parameters.AddWithValue("@source", $OrderData.Source) | Out-Null
        $ins.Parameters.AddWithValue("@fulfillment", [int]$OrderData.Fulfillment) | Out-Null
        $ins.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $ins.Parameters.AddWithValue("@depTime", [datetime]$OrderData.RiderDepartureTime) | Out-Null
        $ins.Parameters.AddWithValue("@address", $(if ($OrderData.DeliveryAddress) { $OrderData.DeliveryAddress } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@landmark", $(if ($OrderData.Landmark) { $OrderData.Landmark } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@remarks", $(if ($OrderData.Remarks) { $OrderData.Remarks } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $ins.Parameters.AddWithValue("@deliveryFee", [decimal]$OrderData.DeliveryFee) | Out-Null
        $ins.Parameters.AddWithValue("@downpayment", [decimal]$OrderData.Downpayment) | Out-Null
        $ins.Parameters.AddWithValue("@dpMethod", $OrderData.DownpaymentMethod) | Out-Null
        $ins.Parameters.AddWithValue("@grandTotal", [decimal]$OrderData.GrandTotal) | Out-Null
        $ins.Parameters.AddWithValue("@isTrusted", [bool]$OrderData.IsTrustedCustomer) | Out-Null
        $ins.Parameters.AddWithValue("@custodyStatus", $OrderData.SettlementCustodyStatus) | Out-Null
        $ins.Parameters.AddWithValue("@routingStatus", [int]$OrderData.RoutingStatus) | Out-Null
        $ins.Parameters.AddWithValue("@tripId", $(if ($tripId) { [int]$tripId } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@freebiesSummary", $(if ($OrderData.FreebiesSummary) { $OrderData.FreebiesSummary } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@freebiesJson", $(if ($OrderData.FreebiesConfigJson) { $OrderData.FreebiesConfigJson } else { [DBNull]::Value })) | Out-Null
        $orderId = [int]$ins.ExecuteScalar()
    }

    # 3. Upsert OrderItem
    $itemCheck = $conn.CreateCommand()
    $itemCheck.CommandText = "SELECT TOP 1 Id FROM OrderItems WHERE OrderId = @orderId ORDER BY Id ASC"
    $itemCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
    $orderItemId = $itemCheck.ExecuteScalar()

    if ($orderItemId) {
        $orderItemId = [int]$orderItemId
        Write-Host "  Updating OrderItem (ID: $orderItemId)..." -ForegroundColor DarkGray
        $itemUpd = $conn.CreateCommand()
        $itemUpd.CommandText = @"
UPDATE OrderItems SET
    ItemCategoryId = @catId,
    Quantity = 1,
    Price = @price,
    TotalPrice = @price,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $itemUpd.Parameters.AddWithValue("@id", $orderItemId) | Out-Null
        $itemUpd.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $itemUpd.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $itemUpd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "  Inserting OrderItem..." -ForegroundColor DarkGray
        $itemIns = $conn.CreateCommand()
        $itemIns.CommandText = @"
INSERT INTO OrderItems (OrderId, ItemCategoryId, Quantity, Price, TotalPrice, CreatedAt)
OUTPUT INSERTED.Id
VALUES (@orderId, @catId, 1, @price, @price, GETUTCDATE())
"@
        $itemIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $itemIns.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $itemIns.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $orderItemId = [int]$itemIns.ExecuteScalar()
    }

    # 4. Upsert OrderItemSchedule
    $schedCheck = $conn.CreateCommand()
    $schedCheck.CommandText = "SELECT TOP 1 Id FROM OrderItemSchedules WHERE OrderItemId = @orderItemId"
    $schedCheck.Parameters.AddWithValue("@orderItemId", $orderItemId) | Out-Null
    $schedId = $schedCheck.ExecuteScalar()

    if ($schedId) {
        $schedId = [int]$schedId
        Write-Host "  Updating OrderItemSchedule (ID: $schedId)..." -ForegroundColor DarkGray
        $schedUpd = $conn.CreateCommand()
        $schedUpd.CommandText = @"
UPDATE OrderItemSchedules SET
    TargetDeliveryTime = @targetTime,
    PackagingStartTime = @packTime,
    SalangStartTime = @salangTime,
    TahiStartTime = @tahiTime,
    IsManualOverride = 0,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $schedUpd.Parameters.AddWithValue("@id", $schedId) | Out-Null
        $schedUpd.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@packTime", [datetime]$OrderData.PackagingStartTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@salangTime", [datetime]$OrderData.SalangStartTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@tahiTime", [datetime]$OrderData.TahiStartTime) | Out-Null
        $schedUpd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "  Inserting OrderItemSchedule..." -ForegroundColor DarkGray
        $schedIns = $conn.CreateCommand()
        $schedIns.CommandText = @"
INSERT INTO OrderItemSchedules (
    OrderItemId, TargetDeliveryTime, PackagingStartTime, SalangStartTime, TahiStartTime,
    IsManualOverride, CurrentStatus, CreatedAt
) VALUES (
    @orderItemId, @targetTime, @packTime, @salangTime, @tahiTime,
    0, 0, GETUTCDATE()
)
"@
        $schedIns.Parameters.AddWithValue("@orderItemId", $orderItemId) | Out-Null
        $schedIns.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@packTime", [datetime]$OrderData.PackagingStartTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@salangTime", [datetime]$OrderData.SalangStartTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@tahiTime", [datetime]$OrderData.TahiStartTime) | Out-Null
        $schedIns.ExecuteNonQuery() | Out-Null
    }

    # 5. Upsert PaymentLogs
    foreach ($pay in $OrderData.Payments) {
        $payCheck = $conn.CreateCommand()
        $payCheck.CommandText = "SELECT TOP 1 Id FROM PaymentLogs WHERE GatewayReferenceId = @ref"
        $payCheck.Parameters.AddWithValue("@ref", $pay.GatewayReferenceId) | Out-Null
        $payId = $payCheck.ExecuteScalar()

        if ($payId) {
            $payUpd = $conn.CreateCommand()
            $payUpd.CommandText = @"
UPDATE PaymentLogs SET
    OrderId = @orderId,
    Provider = @provider,
    PaymentMethod = @method,
    Amount = @amount,
    Status = @status,
    IsVoided = 0,
    VoidedAt = NULL,
    VoidedBy = NULL,
    VoidReason = NULL,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
            $payUpd.Parameters.AddWithValue("@id", [int]$payId) | Out-Null
            $payUpd.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
            $payUpd.Parameters.AddWithValue("@provider", [int]$pay.Provider) | Out-Null
            $payUpd.Parameters.AddWithValue("@method", $pay.PaymentMethod) | Out-Null
            $payUpd.Parameters.AddWithValue("@amount", [decimal]$pay.Amount) | Out-Null
            $payUpd.Parameters.AddWithValue("@status", [int]$pay.Status) | Out-Null
            $payUpd.ExecuteNonQuery() | Out-Null
            Write-Host "  Updated PaymentLog: $($pay.GatewayReferenceId) (₱$($pay.Amount)) for Order $orderId" -ForegroundColor DarkGray
        } else {
            $payIns = $conn.CreateCommand()
            $payIns.CommandText = @"
INSERT INTO PaymentLogs (
    OrderId, GatewayReferenceId, Provider, PaymentMethod, Amount, Status, IsVoided, CreatedAt
) VALUES (
    @orderId, @ref, @provider, @method, @amount, @status, 0, GETUTCDATE()
)
"@
            $payIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
            $payIns.Parameters.AddWithValue("@ref", $pay.GatewayReferenceId) | Out-Null
            $payIns.Parameters.AddWithValue("@provider", [int]$pay.Provider) | Out-Null
            $payIns.Parameters.AddWithValue("@method", $pay.PaymentMethod) | Out-Null
            $payIns.Parameters.AddWithValue("@amount", [decimal]$pay.Amount) | Out-Null
            $payIns.Parameters.AddWithValue("@status", [int]$pay.Status) | Out-Null
            $payIns.ExecuteNonQuery() | Out-Null
            Write-Host "  Inserted PaymentLog: $($pay.GatewayReferenceId) (₱$($pay.Amount))" -ForegroundColor DarkGray
        }
    }

    # 6. Upsert InventoryReservation
    $resDate = [datetime]$OrderData.TargetDeliveryTime
    $resDateOnly = [datetime]::new($resDate.Year, $resDate.Month, $resDate.Day)

    $resCheck = $conn.CreateCommand()
    $resCheck.CommandText = "SELECT TOP 1 Id FROM InventoryReservations WHERE OrderId = @orderId"
    $resCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
    $resId = $resCheck.ExecuteScalar()

    if ($resId) {
        $resUpd = $conn.CreateCommand()
        $resUpd.CommandText = @"
UPDATE InventoryReservations SET
    ItemCategoryId = @catId,
    ReservationDate = @resDate,
    Status = 1,
    ReservationStatus = 1,
    IsCancelled = 0,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $resUpd.Parameters.AddWithValue("@id", [int]$resId) | Out-Null
        $resUpd.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $resUpd.Parameters.AddWithValue("@resDate", $resDateOnly) | Out-Null
        $resUpd.ExecuteNonQuery() | Out-Null
        Write-Host "  Updated InventoryReservation: Category $($OrderData.ItemCategoryId)" -ForegroundColor DarkGray
    } else {
        $resIns = $conn.CreateCommand()
        $resIns.CommandText = @"
INSERT INTO InventoryReservations (
    OrderId, ItemCategoryId, ReservationDate, Status, ReservationStatus, IsCancelled, CreatedAt
) VALUES (
    @orderId, @catId, @resDate, 1, 1, 0, GETUTCDATE()
)
"@
        $resIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $resIns.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $resIns.Parameters.AddWithValue("@resDate", $resDateOnly) | Out-Null
        $resIns.ExecuteNonQuery() | Out-Null
        Write-Host "  Inserted InventoryReservation: Category $($OrderData.ItemCategoryId)" -ForegroundColor DarkGray
    }

    # 7. Customer Profile
    Upsert-CustomerProfile `
        -phone $OrderData.ContactNumber `
        -name $OrderData.CustomerName `
        -fbName $OrderData.FacebookName `
        -address $OrderData.DeliveryAddress `
        -landmark $OrderData.Landmark `
        -preferences $OrderData.Preferences `
        -isVip ([bool]$OrderData.IsTrustedCustomer)

    # 8. Audit Log
    $auditCheck = $conn.CreateCommand()
    $auditCheck.CommandText = "SELECT TOP 1 Id FROM OrderAuditLogs WHERE OrderId = @orderId AND ActionType = 'QA Seed Nov 06'"
    $auditCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
    $auditId = $auditCheck.ExecuteScalar()

    if (-not $auditId) {
        $auditIns = $conn.CreateCommand()
        $auditIns.CommandText = @"
INSERT INTO OrderAuditLogs (OrderId, ActionType, Changes, ChangedBy, Timestamp, CreatedAt)
VALUES (@orderId, 'QA Seed Nov 06', @changes, 'QA System', GETUTCDATE(), GETUTCDATE())
"@
        $auditIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $auditIns.Parameters.AddWithValue("@changes", "Seeded QA order #$ref for $($OrderData.CustomerName) (Nov 06 Enhancements)") | Out-Null
        $auditIns.ExecuteNonQuery() | Out-Null
    }

    Write-Host "Successfully upserted #$ref (ID: $orderId)!" -ForegroundColor Green
    return $orderId
}

# =========================================================================
# Order 1: Piolo Pascual (#110626-921) - Nov 6 Delivery, AL Rider, ₱12,000 Uncollected
# =========================================================================
$order1 = @{
    OrderReference = "110626-921"
    CustomerName = "Piolo Pascual"
    FacebookName = "Piolo Pascual Official"
    ContactNumber = "09170000921"
    Source = "Business FB Page"
    Fulfillment = 1 # Delivery
    AssignedRider = "AL"
    TargetDeliveryTime = "2026-11-06 15:00:00"
    RiderDepartureTime = "2026-11-06 14:00:00"
    DeliveryAddress = "Bacoor, Cavite"
    Landmark = "Near Bacoor City Hall"
    Remarks = "QA Seed Order #110626-921"
    Preferences = "Prefers extra crispy skin."
    ItemCategoryId = 5 # L Lechon (25-27kg)
    Price = 13500.00
    DeliveryFee = 350.00
    Downpayment = 1850.00
    DownpaymentMethod = "GCash"
    GrandTotal = 13850.00
    IsTrustedCustomer = 0
    SettlementCustodyStatus = "Uncollected"
    RoutingStatus = 1 # Assigned
    FreebiesSummary = "🎁 7 Whole Lechon Freebies"
    FreebiesConfigJson = '{"optOut":false,"pigsWithFreebies":1,"rawInnards":false,"counts":{"Sarsa":1,"1.5L Coke":1,"Pancit":1,"Palabok":1,"Spaghetti":1,"Dinuguan":1,"Puto":1},"customizationNote":"","bellyCounts":{"Sarsa":0,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"bellyCustomizationNote":"","bellySignature":""}'
    PackagingStartTime = "2026-11-06 13:30:00"
    SalangStartTime = "2026-11-06 10:30:00"
    TahiStartTime = "2026-11-06 09:30:00"
    Payments = @(
        @{
            GatewayReferenceId = "QA-110626-921-DP"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 1850.00
            Status = 1 # Success
        }
    )
}

# =========================================================================
# Order 2: Sam Sam (#110626-922) - Nov 7 Lalamove, 1x Belly 5kg, ₱3,200 Uncollected
# =========================================================================
$order2 = @{
    OrderReference = "110626-922"
    CustomerName = "Sam Sam"
    FacebookName = "Sam Sam"
    ContactNumber = "09170000922"
    Source = "Business FB Page"
    Fulfillment = 2 # Lalamove
    AssignedRider = $null
    TargetDeliveryTime = "2026-11-07 12:00:00"
    RiderDepartureTime = "2026-11-07 12:00:00"
    DeliveryAddress = "Imus, Cavite"
    Landmark = "Near Imus Market"
    Remarks = "QA Seed Order #110626-922"
    Preferences = "1x Sarsa + 1x Pancit freebie swap."
    ItemCategoryId = 13 # Belly 5kg
    Price = 4200.00
    DeliveryFee = 0.00
    Downpayment = 1000.00
    DownpaymentMethod = "GCash"
    GrandTotal = 4200.00
    IsTrustedCustomer = 0
    SettlementCustodyStatus = "Uncollected"
    RoutingStatus = 0 # Unassigned
    FreebiesSummary = "🎁 Belly Freebies: 1x Sarsa, 1x Pancit"
    FreebiesConfigJson = '{"optOut":false,"pigsWithFreebies":0,"rawInnards":false,"counts":{"Sarsa":0,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"customizationNote":"","bellyCounts":{"Sarsa":1,"1.5L Coke":0,"Pancit":1,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"bellyCustomizationNote":"","bellySignature":"5x1"}'
    PackagingStartTime = "2026-11-07 11:45:00"
    SalangStartTime = "2026-11-07 09:30:00"
    TahiStartTime = "2026-11-07 09:00:00"
    Payments = @(
        @{
            GatewayReferenceId = "QA-110626-922-DP"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 1000.00
            Status = 1 # Success
        }
    )
}

# Execute Upserts
Upsert-FullQaOrder -OrderData $order1
Upsert-FullQaOrder -OrderData $order2

Write-Host "`nAll 2 QA orders successfully upserted for Nov 06 & Nov 07!" -ForegroundColor Green
$conn.Close()
