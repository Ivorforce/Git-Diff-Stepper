export function smoothstep(min, max, value) {
    var x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

export function smoothstep_one(value) {
    return value * value * (3 - 2 * value);
};
