$connStr = "Server=localhost\SQLEXPRESS;Database=LechonSystemDb;Trusted_Connection=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

# Helper function to upsert an order
function Upsert-QaOrder {
    param(
        [string]$ref,
        [string]$customerName,
        [string]$phone,
        [string]$source,
        [int]$fulfillment,
        [string]$targetTime,
        [string]$riderDepartureTime,
        [int]$isTimeTbd,
        [string]$address,
        [decimal]$price,
        [decimal]$deliveryFee,
        [decimal]$downpayment,
        [string]$downpaymentMethod,
        [decimal]$grandTotal,
        [int]$isTrusted,
        [string]$custodyStatus,
        [string]$staffValidatedBy,
        [string]$staffValidatedAt,
        [string]$heldByStaffMethod,
        [int]$routingStatus,
        [int]$categoryId,
        [string]$assignedRider = $null
    )

    $tripId = $null
    if ($assignedRider) {
        $tripCmd = $conn.CreateCommand()
        $tripCmd.CommandText = "SELECT TOP 1 Id FROM DeliveryTrips WHERE RiderName = @rider ORDER BY Id DESC"
        $tripCmd.Parameters.AddWithValue("@rider", $assignedRider) | Out-Null
        $existingTrip = $tripCmd.ExecuteScalar()
        if ($existingTrip) {
            $tripId = [int]$existingTrip
        } else {
            $insTrip = $conn.CreateCommand()
            $insTrip.CommandText = @"
INSERT INTO DeliveryTrips (RiderName, VehicleType, Status, DispatchTime, CreatedAt)
OUTPUT INSERTED.Id
VALUES (@rider, 'Motorcycle', @status, @dispatchTime, GETUTCDATE())
"@
            $insTrip.Parameters.AddWithValue("@rider", $assignedRider) | Out-Null
            $insTrip.Parameters.AddWithValue("@status", $routingStatus) | Out-Null
            $dispatchVal = if ($riderDepartureTime) { [datetime]$riderDepartureTime } else { [DBNull]::Value }
            $insTrip.Parameters.AddWithValue("@dispatchTime", $dispatchVal) | Out-Null
            $tripId = [int]$insTrip.ExecuteScalar()
        }
    }

    # Check if order exists
    $checkCmd = $conn.CreateCommand()
    $checkCmd.CommandText = "SELECT Id FROM Orders WHERE OrderReference = @ref"
    $checkCmd.Parameters.AddWithValue("@ref", $ref) | Out-Null
    $orderId = $checkCmd.ExecuteScalar()

    if ($orderId) {
        Write-Host "Updating existing Order $ref (ID: $orderId)..."
        $updCmd = $conn.CreateCommand()
        $updCmd.CommandText = @"
UPDATE Orders SET
    CustomerName = @customerName,
    ContactNumber = @phone,
    Source = @source,
    Fulfillment = @fulfillment,
    TargetDeliveryTime = @targetTime,
    RiderDepartureTime = @riderDepartureTime,
    IsTimeTbd = @isTimeTbd,
    IsDraft = 0,
    IsDeliveryDetailsConfirmed = 1,
    IsCancelled = 0,
    IsPriceWaived = 0,
    IsOwnerConfirmed = 1,
    DeliveryAddress = @address,
    Price = @price,
    DeliveryFee = @deliveryFee,
    Downpayment = @downpayment,
    DownpaymentMethod = @downpaymentMethod,
    GrandTotal = @grandTotal,
    IsTrustedCustomer = @isTrusted,
    SettlementCustodyStatus = @custodyStatus,
    StaffValidatedBy = @staffValidatedBy,
    StaffValidatedAt = @staffValidatedAt,
    HeldByStaffMethod = @heldByStaffMethod,
    RoutingStatus = @routingStatus,
    DeliveryTripId = @tripId,
    UpdatedAt = GETUTCDATE()
WHERE Id = @id
"@
        $updCmd.Parameters.AddWithValue("@id", [int]$orderId) | Out-Null
        $updCmd.Parameters.AddWithValue("@customerName", $customerName) | Out-Null
        $updCmd.Parameters.AddWithValue("@phone", $phone) | Out-Null
        $updCmd.Parameters.AddWithValue("@source", $source) | Out-Null
        $updCmd.Parameters.AddWithValue("@fulfillment", $fulfillment) | Out-Null
        $targetVal = if ($targetTime) { [datetime]$targetTime } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@targetTime", $targetVal) | Out-Null
        $depVal = if ($riderDepartureTime) { [datetime]$riderDepartureTime } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@riderDepartureTime", $depVal) | Out-Null
        $updCmd.Parameters.AddWithValue("@isTimeTbd", [bool]$isTimeTbd) | Out-Null
        $updCmd.Parameters.AddWithValue("@address", $address) | Out-Null
        $updCmd.Parameters.AddWithValue("@price", $price) | Out-Null
        $updCmd.Parameters.AddWithValue("@deliveryFee", $deliveryFee) | Out-Null
        $updCmd.Parameters.AddWithValue("@downpayment", $downpayment) | Out-Null
        $updCmd.Parameters.AddWithValue("@downpaymentMethod", $downpaymentMethod) | Out-Null
        $updCmd.Parameters.AddWithValue("@grandTotal", $grandTotal) | Out-Null
        $updCmd.Parameters.AddWithValue("@isTrusted", [bool]$isTrusted) | Out-Null
        $updCmd.Parameters.AddWithValue("@custodyStatus", $custodyStatus) | Out-Null
        $staffByVal = if ($staffValidatedBy) { $staffValidatedBy } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@staffValidatedBy", $staffByVal) | Out-Null
        $staffAtVal = if ($staffValidatedAt) { [datetime]$staffValidatedAt } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@staffValidatedAt", $staffAtVal) | Out-Null
        $heldVal = if ($heldByStaffMethod) { $heldByStaffMethod } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@heldByStaffMethod", $heldVal) | Out-Null
        $updCmd.Parameters.AddWithValue("@routingStatus", $routingStatus) | Out-Null
        $tripVal = if ($tripId) { [int]$tripId } else { [DBNull]::Value }
        $updCmd.Parameters.AddWithValue("@tripId", $tripVal) | Out-Null
        $updCmd.ExecuteNonQuery() | Out-Null
    } else {
        Write-Host "Inserting new Order $ref ($customerName)..."
        $insCmd = $conn.CreateCommand()
        $insCmd.CommandText = @"
INSERT INTO Orders (
    OrderReference, CustomerName, ContactNumber, Source, Fulfillment,
    TargetDeliveryTime, RiderDepartureTime, IsTimeTbd, IsDraft, IsDeliveryDetailsConfirmed,
    IsCancelled, IsPriceWaived, IsOwnerConfirmed, DeliveryAddress,
    Price, DeliveryFee, Downpayment, DownpaymentMethod, GrandTotal, Discount,
    IsTrustedCustomer, SettlementCustodyStatus, StaffValidatedBy, StaffValidatedAt,
    HeldByStaffMethod, RoutingStatus, DeliveryTripId, CreatedBy, CreatedAt
)
OUTPUT INSERTED.Id
VALUES (
    @ref, @customerName, @phone, @source, @fulfillment,
    @targetTime, @riderDepartureTime, @isTimeTbd, 0, 1,
    0, 0, 1, @address,
    @price, @deliveryFee, @downpayment, @downpaymentMethod, @grandTotal, 0,
    @isTrusted, @custodyStatus, @staffValidatedBy, @staffValidatedAt,
    @heldByStaffMethod, @routingStatus, @tripId, 'QA Seed', GETUTCDATE()
)
"@
        $insCmd.Parameters.AddWithValue("@ref", $ref) | Out-Null
        $insCmd.Parameters.AddWithValue("@customerName", $customerName) | Out-Null
        $insCmd.Parameters.AddWithValue("@phone", $phone) | Out-Null
        $insCmd.Parameters.AddWithValue("@source", $source) | Out-Null
        $insCmd.Parameters.AddWithValue("@fulfillment", $fulfillment) | Out-Null
        $targetVal = if ($targetTime) { [datetime]$targetTime } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@targetTime", $targetVal) | Out-Null
        $depVal = if ($riderDepartureTime) { [datetime]$riderDepartureTime } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@riderDepartureTime", $depVal) | Out-Null
        $insCmd.Parameters.AddWithValue("@isTimeTbd", [bool]$isTimeTbd) | Out-Null
        $insCmd.Parameters.AddWithValue("@address", $address) | Out-Null
        $insCmd.Parameters.AddWithValue("@price", $price) | Out-Null
        $insCmd.Parameters.AddWithValue("@deliveryFee", $deliveryFee) | Out-Null
        $insCmd.Parameters.AddWithValue("@downpayment", $downpayment) | Out-Null
        $insCmd.Parameters.AddWithValue("@downpaymentMethod", $downpaymentMethod) | Out-Null
        $insCmd.Parameters.AddWithValue("@grandTotal", $grandTotal) | Out-Null
        $insCmd.Parameters.AddWithValue("@isTrusted", [bool]$isTrusted) | Out-Null
        $insCmd.Parameters.AddWithValue("@custodyStatus", $custodyStatus) | Out-Null
        $staffByVal = if ($staffValidatedBy) { $staffValidatedBy } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@staffValidatedBy", $staffByVal) | Out-Null
        $staffAtVal = if ($staffValidatedAt) { [datetime]$staffValidatedAt } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@staffValidatedAt", $staffAtVal) | Out-Null
        $heldVal = if ($heldByStaffMethod) { $heldByStaffMethod } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@heldByStaffMethod", $heldVal) | Out-Null
        $insCmd.Parameters.AddWithValue("@routingStatus", $routingStatus) | Out-Null
        $tripVal = if ($tripId) { [int]$tripId } else { [DBNull]::Value }
        $insCmd.Parameters.AddWithValue("@tripId", $tripVal) | Out-Null
        $orderId = [int]$insCmd.ExecuteScalar()

        # Insert OrderItem
        $itemCmd = $conn.CreateCommand()
        $itemCmd.CommandText = @"
INSERT INTO OrderItems (OrderId, ItemCategoryId, Quantity, Price, TotalPrice, CreatedAt)
VALUES (@orderId, @catId, 1, @price, @price, GETUTCDATE())
"@
        $itemCmd.Parameters.AddWithValue("@orderId", $orderId) | Out-Null
        $itemCmd.Parameters.AddWithValue("@catId", $categoryId) | Out-Null
        $itemCmd.Parameters.AddWithValue("@price", $price) | Out-Null
        $itemCmd.ExecuteNonQuery() | Out-Null
    }
}

# 1. #102926-910: Nora Aunor (Past Shift Drawer)
Upsert-QaOrder `
    -ref "102926-910" `
    -customerName "Nora Aunor (Past Shift Drawer)" `
    -phone "09171112233" `
    -source "Business FB Page" `
    -fulfillment 1 `
    -targetTime "2026-10-29 11:30:00" `
    -riderDepartureTime "2026-10-29 10:30:00" `
    -isTimeTbd 0 `
    -address "123 Bicol St, Imus, Cavite" `
    -price 13500.00 `
    -deliveryFee 500.00 `
    -downpayment 2000.00 `
    -downpaymentMethod "GCash" `
    -grandTotal 14000.00 `
    -isTrusted 0 `
    -custodyStatus "InStaffDrawer" `
    -staffValidatedBy "Cashier Sarah" `
    -staffValidatedAt "2026-10-29 14:00:00" `
    -heldByStaffMethod "Cash" `
    -routingStatus 3 `
    -categoryId 5 `
    -assignedRider "AL"

# 2. #103026-911: Vilma Santos (Today Drawer)
Upsert-QaOrder `
    -ref "103026-911" `
    -customerName "Vilma Santos (Today Drawer)" `
    -phone "09172223344" `
    -source "Walk-in" `
    -fulfillment 0 `
    -targetTime "2026-10-30 11:30:00" `
    -riderDepartureTime "2026-10-30 11:30:00" `
    -isTimeTbd 0 `
    -address "Store Pickup Counter" `
    -price 12700.00 `
    -deliveryFee 0.00 `
    -downpayment 2000.00 `
    -downpaymentMethod "Cash" `
    -grandTotal 12700.00 `
    -isTrusted 0 `
    -custodyStatus "InStaffDrawer" `
    -staffValidatedBy "Cashier Sarah" `
    -staffValidatedAt "2026-10-30 11:45:00" `
    -heldByStaffMethod "Cash" `
    -routingStatus 3 `
    -categoryId 4

# 3. #103026-912: Coco Martin (Lalamove No DP)
Upsert-QaOrder `
    -ref "103026-912" `
    -customerName "Coco Martin (Lalamove No DP)" `
    -phone "09173334455" `
    -source "Business FB Page" `
    -fulfillment 2 `
    -targetTime "2026-10-30 16:00:00" `
    -riderDepartureTime "2026-10-30 16:00:00" `
    -isTimeTbd 0 `
    -address "Lalamove Pickup Gate" `
    -price 14000.00 `
    -deliveryFee 0.00 `
    -downpayment 0.00 `
    -downpaymentMethod "None" `
    -grandTotal 14000.00 `
    -isTrusted 0 `
    -custodyStatus "Uncollected" `
    -staffValidatedBy $null `
    -staffValidatedAt $null `
    -heldByStaffMethod $null `
    -routingStatus 0 `
    -categoryId 6

# 4. #103026-913: Sharon Cuneta (Time TBD Today)
Upsert-QaOrder `
    -ref "103026-913" `
    -customerName "Sharon Cuneta (Time TBD Today)" `
    -phone "09174445566" `
    -source "Business FB Page" `
    -fulfillment 1 `
    -targetTime "2026-10-30 12:00:00" `
    -riderDepartureTime $null `
    -isTimeTbd 1 `
    -address "Grand Villas, Imus, Cavite" `
    -price 13500.00 `
    -deliveryFee 300.00 `
    -downpayment 3000.00 `
    -downpaymentMethod "GCash" `
    -grandTotal 13800.00 `
    -isTrusted 0 `
    -custodyStatus "Uncollected" `
    -staffValidatedBy $null `
    -staffValidatedAt $null `
    -heldByStaffMethod $null `
    -routingStatus 0 `
    -categoryId 5

# 5. #103126-914: Piolo Pascual (Tomorrow Dual Alert)
Upsert-QaOrder `
    -ref "103126-914" `
    -customerName "Piolo Pascual (Tomorrow Dual Alert)" `
    -phone "09175556677" `
    -source "Business FB Page" `
    -fulfillment 1 `
    -targetTime "2026-10-31 12:00:00" `
    -riderDepartureTime $null `
    -isTimeTbd 1 `
    -address "Parkway Subd, Bacoor, Cavite" `
    -price 13500.00 `
    -deliveryFee 300.00 `
    -downpayment 0.00 `
    -downpaymentMethod "None" `
    -grandTotal 13800.00 `
    -isTrusted 0 `
    -custodyStatus "Uncollected" `
    -staffValidatedBy $null `
    -staffValidatedAt $null `
    -heldByStaffMethod $null `
    -routingStatus 0 `
    -categoryId 5

# 6. #110426-915: Kathryn Bernardo (Nov 4 Pending Deposit)
Upsert-QaOrder `
    -ref "110426-915" `
    -customerName "Kathryn Bernardo (Nov 4 Pending Deposit)" `
    -phone "09176667788" `
    -source "Business FB Page" `
    -fulfillment 1 `
    -targetTime "2026-11-04 12:30:00" `
    -riderDepartureTime "2026-11-04 11:30:00" `
    -isTimeTbd 0 `
    -address "Villa Isabel, Dasmarinas, Cavite" `
    -price 13500.00 `
    -deliveryFee 300.00 `
    -downpayment 0.00 `
    -downpaymentMethod "None" `
    -grandTotal 13800.00 `
    -isTrusted 0 `
    -custodyStatus "Uncollected" `
    -staffValidatedBy $null `
    -staffValidatedAt $null `
    -heldByStaffMethod $null `
    -routingStatus 0 `
    -categoryId 5

Write-Host "Targeted QA Seeding Complete!"
$conn.Close()
