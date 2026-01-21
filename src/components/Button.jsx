const Button = ({ children, onClick, variant = "primary", className = "", ...props }) => {
    const baseStyles = "px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20",
        secondary: "bg-bg-tertiary hover:bg-bg-secondary text-text-primary",
        outline: "border border-accent text-accent hover:bg-accent/10"
    };

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
