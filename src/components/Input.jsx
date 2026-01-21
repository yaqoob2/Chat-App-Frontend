const Input = ({ label, type = "text", value, onChange, placeholder, icon, className = "", ...props }) => {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && <label className="text-sm text-text-secondary font-medium">{label}</label>}
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`w-full bg-bg-tertiary text-text-primary px-4 py-3 rounded-lg border border-transparent focus:border-accent transition-colors outline-none ${icon ? 'pl-10' : ''}`}
                    {...props}
                />
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Input;
