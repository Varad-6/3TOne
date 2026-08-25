import React from "react";
export const Spinner = ({ size = "md", color = "border-blue-500", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-4",
    lg: "w-10 h-10 border-4",
  };

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`rounded-full border-t-transparent animate-spin ${sizeClasses[size]} ${color}`}
      />
    </div>
  );
};

export default Spinner;
