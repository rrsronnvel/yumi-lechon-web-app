// 1. Import your newly created form component
import OrderForm from "@/components/ui/orders/OrderForm";

export default function OrdersPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
        <p className="text-gray-500 mt-2">Create new orders and manage incoming requests.</p>
      </div>
      
      {/* 2. Render the form right here! */}
      <OrderForm />
    </div>
  );
}