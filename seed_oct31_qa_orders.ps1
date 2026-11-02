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
    OwnerApprovedBy = @ownerApprovedBy,
    OwnerApprovedAt = @ownerApprovedAt,
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
        $upd.Parameters.AddWithValue("@ownerApprovedBy", $(if ($OrderData.OwnerApprovedBy) { $OrderData.OwnerApprovedBy } else { [DBNull]::Value })) | Out-Null
        $upd.Parameters.AddWithValue("@ownerApprovedAt", $(if ($OrderData.OwnerApprovedAt) { [datetime]$OrderData.OwnerApprovedAt } else { [DBNull]::Value })) | Out-Null
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
    RoutingStatus, DeliveryTripId, OwnerApprovedBy, OwnerApprovedAt, CreatedBy, CreatedAt
)
OUTPUT INSERTED.Id
VALUES (
    @ref, @customerName, @fbName, @phone, @source,
    @fulfillment, @targetTime, @depTime, 0, 0,
    1, 0, 0, 1,
    @address, @landmark, @remarks, @price, @deliveryFee, @downpayment,
    @dpMethod, @grandTotal, 0, @isTrusted, @custodyStatus,
    @routingStatus, @tripId, @ownerApprovedBy, @ownerApprovedAt, 'QA Seed Oct 31', GETUTCDATE()
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
        $ins.Parameters.AddWithValue("@ownerApprovedBy", $(if ($OrderData.OwnerApprovedBy) { $OrderData.OwnerApprovedBy } else { [DBNull]::Value })) | Out-Null
        $ins.Parameters.AddWithValue("@ownerApprovedAt", $(if ($OrderData.OwnerApprovedAt) { [datetime]$OrderData.OwnerApprovedAt } else { [DBNull]::Value })) | Out-Null
        $orderId = [int]$ins.ExecuteScalar()
    }

    # 3. Upsert OrderItem
    $itemCheck = $conn.CreateCommand()
    $itemCheck.CommandText = "SELECT TOP 1 Id FROM OrderItems WHERE OrderId = @orderId ORDER BY Id ASC"
    $itemCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
    $orderItemId = $itemCheck.ExecuteScalar()

    $fulfilledCatVal = if ($OrderData.FulfilledItemCategoryId) { [int]$OrderData.FulfilledItemCategoryId } else { [DBNull]::Value }

    if ($orderItemId) {
        $orderItemId = [int]$orderItemId
        Write-Host "  Updating OrderItem (ID: $orderItemId)..." -ForegroundColor DarkGray
        $itemUpd = $conn.CreateCommand()
        $itemUpd.CommandText = @"
UPDATE OrderItems SET
    ItemCategoryId = @catId,
    FulfilledItemCategoryId = @fulfilledCatId,
    Quantity = 1,
    Price = @price,
    TotalPrice = @price,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $itemUpd.Parameters.AddWithValue("@id", $orderItemId) | Out-Null
        $itemUpd.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $itemUpd.Parameters.AddWithValue("@fulfilledCatId", $fulfilledCatVal) | Out-Null
        $itemUpd.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $itemUpd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "  Inserting OrderItem..." -ForegroundColor DarkGray
        $itemIns = $conn.CreateCommand()
        $itemIns.CommandText = @"
INSERT INTO OrderItems (OrderId, ItemCategoryId, FulfilledItemCategoryId, Quantity, Price, TotalPrice, CreatedAt)
OUTPUT INSERTED.Id
VALUES (@orderId, @catId, @fulfilledCatId, 1, @price, @price, GETUTCDATE())
"@
        $itemIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $itemIns.Parameters.AddWithValue("@catId", [int]$OrderData.ItemCategoryId) | Out-Null
        $itemIns.Parameters.AddWithValue("@fulfilledCatId", $fulfilledCatVal) | Out-Null
        $itemIns.Parameters.AddWithValue("@price", [decimal]$OrderData.Price) | Out-Null
        $orderItemId = [int]$itemIns.ExecuteScalar()
    }

    # 4. Upsert OrderItemSchedule
    $schedCheck = $conn.CreateCommand()
    $schedCheck.CommandText = "SELECT TOP 1 Id FROM OrderItemSchedules WHERE OrderItemId = @orderItemId"
    $schedCheck.Parameters.AddWithValue("@orderItemId", $orderItemId) | Out-Null
    $schedId = $schedCheck.ExecuteScalar()

    $customWeightVal = if ($OrderData.CustomWeightDisplay) { $OrderData.CustomWeightDisplay } else { [DBNull]::Value }

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
    CustomWeightDisplay = @customWeight,
    IsManualOverride = 0,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $schedUpd.Parameters.AddWithValue("@id", $schedId) | Out-Null
        $schedUpd.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@packTime", [datetime]$OrderData.PackagingStartTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@salangTime", [datetime]$OrderData.SalangStartTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@tahiTime", [datetime]$OrderData.TahiStartTime) | Out-Null
        $schedUpd.Parameters.AddWithValue("@customWeight", $customWeightVal) | Out-Null
        $schedUpd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "  Inserting OrderItemSchedule..." -ForegroundColor DarkGray
        $schedIns = $conn.CreateCommand()
        $schedIns.CommandText = @"
INSERT INTO OrderItemSchedules (
    OrderItemId, TargetDeliveryTime, PackagingStartTime, SalangStartTime, TahiStartTime,
    CustomWeightDisplay, IsManualOverride, CurrentStatus, CreatedAt
) VALUES (
    @orderItemId, @targetTime, @packTime, @salangTime, @tahiTime,
    @customWeight, 0, 0, GETUTCDATE()
)
"@
        $schedIns.Parameters.AddWithValue("@orderItemId", $orderItemId) | Out-Null
        $schedIns.Parameters.AddWithValue("@targetTime", [datetime]$OrderData.TargetDeliveryTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@packTime", [datetime]$OrderData.PackagingStartTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@salangTime", [datetime]$OrderData.SalangStartTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@tahiTime", [datetime]$OrderData.TahiStartTime) | Out-Null
        $schedIns.Parameters.AddWithValue("@customWeight", $customWeightVal) | Out-Null
        $schedIns.ExecuteNonQuery() | Out-Null
    }

    # 5. Upsert PaymentLogs
    foreach ($pay in $OrderData.Payments) {
        $payCheck = $conn.CreateCommand()
        $payCheck.CommandText = "SELECT TOP 1 Id FROM PaymentLogs WHERE OrderId = @orderId AND GatewayReferenceId = @ref"
        $payCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $payCheck.Parameters.AddWithValue("@ref", $pay.GatewayReferenceId) | Out-Null
        $payId = $payCheck.ExecuteScalar()

        if ($payId) {
            $payUpd = $conn.CreateCommand()
            $payUpd.CommandText = @"
UPDATE PaymentLogs SET
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
            $payUpd.Parameters.AddWithValue("@provider", [int]$pay.Provider) | Out-Null
            $payUpd.Parameters.AddWithValue("@method", $pay.PaymentMethod) | Out-Null
            $payUpd.Parameters.AddWithValue("@amount", [decimal]$pay.Amount) | Out-Null
            $payUpd.Parameters.AddWithValue("@status", [int]$pay.Status) | Out-Null
            $payUpd.ExecuteNonQuery() | Out-Null
            Write-Host "  Updated PaymentLog: $($pay.GatewayReferenceId) (₱$($pay.Amount))" -ForegroundColor DarkGray
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
    $resCatId = if ($OrderData.FulfilledItemCategoryId) { [int]$OrderData.FulfilledItemCategoryId } else { [int]$OrderData.ItemCategoryId }
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
        $resUpd.Parameters.AddWithValue("@catId", $resCatId) | Out-Null
        $resUpd.Parameters.AddWithValue("@resDate", $resDateOnly) | Out-Null
        $resUpd.ExecuteNonQuery() | Out-Null
        Write-Host "  Updated InventoryReservation: Category $resCatId" -ForegroundColor DarkGray
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
        $resIns.Parameters.AddWithValue("@catId", $resCatId) | Out-Null
        $resIns.Parameters.AddWithValue("@resDate", $resDateOnly) | Out-Null
        $resIns.ExecuteNonQuery() | Out-Null
        Write-Host "  Inserted InventoryReservation: Category $resCatId" -ForegroundColor DarkGray
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
    $auditCheck.CommandText = "SELECT TOP 1 Id FROM OrderAuditLogs WHERE OrderId = @orderId AND ActionType = 'QA Seed'"
    $auditCheck.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
    $auditId = $auditCheck.ExecuteScalar()

    if (-not $auditId) {
        $auditIns = $conn.CreateCommand()
        $auditIns.CommandText = @"
INSERT INTO OrderAuditLogs (OrderId, ActionType, Changes, ChangedBy, Timestamp, CreatedAt)
VALUES (@orderId, 'QA Seed', @changes, 'QA System', GETUTCDATE(), GETUTCDATE())
"@
        $auditIns.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $auditIns.Parameters.AddWithValue("@changes", "Seeded QA order #$ref for $($OrderData.CustomerName) (Oct 31 Enhancements)") | Out-Null
        $auditIns.ExecuteNonQuery() | Out-Null
    }

    Write-Host "Successfully upserted #$ref (ID: $orderId)!" -ForegroundColor Green
    return $orderId
}

# =========================================================================
# Order 1: Tests Split Payment in Dossier & Hop 1 (#103126-951)
# =========================================================================
$order1 = @{
    OrderReference = "103126-951"
    CustomerName = "Analyn Alondra (Split Payment QA)"
    FacebookName = "Analyn Alondra"
    ContactNumber = "09178880001"
    Source = "Business FB Page"
    Fulfillment = 1 # Delivery
    AssignedRider = "AL"
    TargetDeliveryTime = "2026-10-31 15:00:00"
    RiderDepartureTime = "2026-10-31 14:00:00"
    DeliveryAddress = "Cabilang Baybay, Carmona, Cavite"
    Landmark = "Near Carmona Elementary School"
    Remarks = "Split Payment QA Test • Ready for Hop 1 Split"
    Preferences = "Split payment preference: GCash and Cash split upon delivery."
    ItemCategoryId = 2 # XS (16-19kg)
    FulfilledItemCategoryId = $null
    Price = 11000.00
    DeliveryFee = 0.00
    Downpayment = 1000.00
    DownpaymentMethod = "GCash"
    GrandTotal = 11000.00
    IsTrustedCustomer = 0
    SettlementCustodyStatus = "Uncollected"
    RoutingStatus = 1 # Assigned
    PackagingStartTime = "2026-10-31 13:30:00" # 14:00 - 30m
    SalangStartTime = "2026-10-31 11:00:00"    # 13:30 - 150m
    TahiStartTime = "2026-10-31 10:00:00"      # 11:00 - 60m
    CustomWeightDisplay = $null
    Payments = @(
        @{
            GatewayReferenceId = "QA-103126-951-DP"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 1000.00
            Status = 1 # Success
        }
    )
}

# =========================================================================
# Order 2: Tests Payment Void Drawer Restoration (#103126-952)
# =========================================================================
$order2 = @{
    OrderReference = "103126-952"
    CustomerName = "Dingdong Dantes (Void Restore QA)"
    FacebookName = "Dingdong Dantes"
    ContactNumber = "09178880002"
    Source = "Business FB Page"
    Fulfillment = 1 # Delivery
    AssignedRider = "Francis"
    TargetDeliveryTime = "2026-10-31 16:00:00"
    RiderDepartureTime = "2026-10-31 15:00:00"
    DeliveryAddress = "Imus, Cavite"
    Landmark = "Near Imus City Hall"
    Remarks = "Payment Void Drawer Restoration QA Test • Has WRONG-ENTRY-10K to void"
    Preferences = "Always request official receipt."
    ItemCategoryId = 4 # M (22-24kg)
    FulfilledItemCategoryId = $null
    Price = 12700.00
    DeliveryFee = 300.00
    Downpayment = 12700.00 # 2700 initial + 10000 wrong entry
    DownpaymentMethod = "GCash"
    GrandTotal = 13000.00
    IsTrustedCustomer = 0
    SettlementCustodyStatus = "Settled"
    RoutingStatus = 3 # Delivered
    OwnerApprovedBy = "Cholo (@cholo)"
    OwnerApprovedAt = "2026-10-31 15:30:00"
    PackagingStartTime = "2026-10-31 14:30:00" # 15:00 - 30m
    SalangStartTime = "2026-10-31 11:30:00"    # 14:30 - 180m
    TahiStartTime = "2026-10-31 10:30:00"      # 11:30 - 60m
    CustomWeightDisplay = $null
    Payments = @(
        @{
            GatewayReferenceId = "QA-103126-952-DP"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 2700.00
            Status = 1 # Success
        },
        @{
            GatewayReferenceId = "WRONG-ENTRY-10K"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 10000.00
            Status = 1 # Success
        }
    )
}

# =========================================================================
# Order 3: Tests Persistent Custom Weight (50) on Daily Sheet (#110126-953)
# =========================================================================
$order3 = @{
    OrderReference = "110126-953"
    CustomerName = "Manny Pacquiao (VIP 50kg Custom Weight QA)"
    FacebookName = "Manny Pacquiao Official"
    ContactNumber = "09178880003"
    Source = "Business FB Page"
    Fulfillment = 1 # Delivery
    AssignedRider = "AL"
    TargetDeliveryTime = "2026-11-01 12:00:00"
    RiderDepartureTime = "2026-11-01 10:30:00"
    DeliveryAddress = "Forbes Park, Makati"
    Landmark = "Forbes Park Gate 1"
    Remarks = "👑 VIP Customer • Special request for 50kg carcass weight"
    Preferences = "👑 VIP Customer • Special request for 50kg carcass weight. Extra crispy."
    ItemCategoryId = 9 # S. Jumbo (41-45kg)
    FulfilledItemCategoryId = $null
    Price = 16500.00
    DeliveryFee = 0.00
    Downpayment = 5000.00
    DownpaymentMethod = "Bank Transfer"
    GrandTotal = 16500.00
    IsTrustedCustomer = 1 # VIP
    SettlementCustodyStatus = "Uncollected"
    RoutingStatus = 1 # Assigned
    PackagingStartTime = "2026-11-01 10:00:00" # 10:30 - 30m
    SalangStartTime = "2026-11-01 05:00:00"    # 10:00 - 300m (5h)
    TahiStartTime = "2026-11-01 04:00:00"      # 05:00 - 60m (1h)
    CustomWeightDisplay = "50"
    Payments = @(
        @{
            GatewayReferenceId = "QA-110126-953-DP"
            Provider = 4 # BankTransfer
            PaymentMethod = "Bank Transfer"
            Amount = 5000.00
            Status = 1 # Success
        }
    )
}

# =========================================================================
# Order 4: Tests Out-of-Stock Free Upgrade (Booked M -> Fulfilled with L) (#110126-954)
# =========================================================================
$order4 = @{
    OrderReference = "110126-954"
    CustomerName = "Marian Rivera (Free Stock Upgrade M to L QA)"
    FacebookName = "Marian Rivera Dantes"
    ContactNumber = "09178880004"
    Source = "Business FB Page"
    Fulfillment = 1 # Delivery
    AssignedRider = "Aaron"
    TargetDeliveryTime = "2026-11-01 13:00:00"
    RiderDepartureTime = "2026-11-01 12:00:00"
    DeliveryAddress = "Dasmarinas, Cavite"
    Landmark = "Near Dasmarinas City Arena"
    Remarks = "Complimentary upgrade from Medium to Large due to stock availability"
    Preferences = "Likes spicy sauce on the side."
    ItemCategoryId = 4 # Booked M (22-24kg)
    FulfilledItemCategoryId = 5 # Fulfilled with L (25-27kg)
    Price = 12700.00 # Booked locked price
    DeliveryFee = 0.00
    Downpayment = 2000.00
    DownpaymentMethod = "GCash"
    GrandTotal = 12700.00
    IsTrustedCustomer = 0
    SettlementCustodyStatus = "Uncollected"
    RoutingStatus = 1 # Assigned
    # Effective cooking profile for Category 5 (L): Tahi 60m, Salang 180m, Packaging 30m
    PackagingStartTime = "2026-11-01 11:30:00" # 12:00 - 30m
    SalangStartTime = "2026-11-01 08:30:00"    # 11:30 - 180m (3h)
    TahiStartTime = "2026-11-01 07:30:00"      # 08:30 - 60m (1h)
    CustomWeightDisplay = $null
    Payments = @(
        @{
            GatewayReferenceId = "QA-110126-954-DP"
            Provider = 1 # ManualGCash
            PaymentMethod = "GCash"
            Amount = 2000.00
            Status = 1 # Success
        }
    )
}

# Execute Upserts
Upsert-FullQaOrder -OrderData $order1
Upsert-FullQaOrder -OrderData $order2
Upsert-FullQaOrder -OrderData $order3
Upsert-FullQaOrder -OrderData $order4

Write-Host "`nAll 4 QA orders successfully upserted!" -ForegroundColor Green
$conn.Close()
