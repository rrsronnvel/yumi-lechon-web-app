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

  useEffect(() => {
    if (isAuthenticated && !isRoleAllowed && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      toast.error("Access Denied", {
        description: `Your account role (${user?.role || "User"}) does not have permission to access this page.`,
      });
    }
  }, [isAuthenticated, isRoleAllowed, user?.role]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isRoleAllowed) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
