export function repeat(delayMs: number, times: number, f: Function) {
    f(0);
    let callCount = 1;
    var repeater = setInterval(function () {
        if (callCount < times) {
            f(callCount);
            callCount += 1;
        } else {
            clearInterval(repeater);
        }
    }, delayMs);
}

export function transition(fps: number, totalTime: number, f: Function) {
    const times = totalTime * fps;
    repeat(1000 / fps, times, (callCount) => f((callCount + 1) / times));
}
