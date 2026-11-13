import React, { useEffect, useRef } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const hasAlertedRef = useRef(false);

  const isRoleAllowed =
    !allowedRoles || (user?.role && allowedRoles.includes(user.role));
  const isAccountantLockedOut =
    isAuthenticated && user?.role === "Accountant" && location.pathname !== "/expenses";

  useEffect(() => {
    if (isAuthenticated && !isRoleAllowed && !isAccountantLockedOut && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      toast.error("Access Denied", {
        description: `Your account role (${user?.role || "User"}) does not have permission to access this page.`,
      });
    }
  }, [isAuthenticated, isRoleAllowed, isAccountantLockedOut, user?.role]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enforce the accountant's isolated surface for direct URLs, history, and
  // otherwise staff-accessible routes from one central guard.
  if (isAccountantLockedOut) {
    return <Navigate to="/expenses" replace />;
  }

  if (!isRoleAllowed) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
