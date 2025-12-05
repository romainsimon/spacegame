import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
export const MusicController = () => {
    const audioRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    useEffect(() => {
        const audio = new Audio('/music/Deep Space Exploration.mp3');
        audio.loop = true;
        audio.volume = 0.35;
        audioRef.current = audio;
        setIsReady(true);
        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);
    const togglePlayback = async () => {
        if (!audioRef.current)
            return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            return;
        }
        try {
            await audioRef.current.play();
            setIsPlaying(true);
        }
        catch (error) {
            console.error('Unable to start music', error);
        }
    };
    return (_jsxs("div", { className: "panel music-panel", children: [_jsx("span", { children: "Soundtrack" }), _jsx("button", { className: "theme", onClick: togglePlayback, disabled: !isReady, children: isPlaying ? 'Pause ambience' : 'Play ambience' })] }));
};
