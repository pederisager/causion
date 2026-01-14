import { useEffect, useState } from "react";

const PHONE_BREAKPOINT = 900;

function snapshot(forcePhoneLayout) {
  if (typeof window === "undefined") {
    return {
      isPhoneLayout: Boolean(forcePhoneLayout),
      orientation: "portrait",
    };
  }
  const { innerWidth: width, innerHeight: height } = window;
  const orientation = width > height ? "landscape" : "portrait";
  const prefersPhone = width <= PHONE_BREAKPOINT || height <= 600;
  return {
    isPhoneLayout: forcePhoneLayout ? true : prefersPhone,
    orientation,
    width,
    height,
  };
}

export function usePhoneLayout(forcePhoneLayout = false) {
  const [state, setState] = useState(() => snapshot(forcePhoneLayout));

  useEffect(() => {
    setState(snapshot(forcePhoneLayout));
    if (typeof window === "undefined") return undefined;

    const handleChange = () => {
      setState(snapshot(forcePhoneLayout));
    };

    window.addEventListener("resize", handleChange);
    window.addEventListener("orientationchange", handleChange);
    return () => {
      window.removeEventListener("resize", handleChange);
      window.removeEventListener("orientationchange", handleChange);
    };
  }, [forcePhoneLayout]);

  return state;
}
