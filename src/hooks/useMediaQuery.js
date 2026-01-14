import { useEffect, useState } from "react";

function evaluateQuery(query) {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth || 0;
  const minMatch = query.match(/min-width:\s*(\d+)px/);
  const maxMatch = query.match(/max-width:\s*(\d+)px/);
  let matches = true;
  if (minMatch) {
    matches = matches && width >= Number(minMatch[1]);
  }
  if (maxMatch) {
    matches = matches && width <= Number(maxMatch[1]);
  }
  return matches;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return evaluateQuery(query);
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (!window.matchMedia) {
      const handleResize = () => {
        setMatches(evaluateQuery(query));
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const media = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    setMatches(media.matches);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}
