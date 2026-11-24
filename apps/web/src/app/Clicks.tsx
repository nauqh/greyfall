"use client";

import { useEffect } from "react";

import { CLICK, play, press } from "./sound";

/** Every button, link and option on every page clicks. */
export function Clicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.target instanceof Element && e.target.closest("button, a[href], summary, label, select, [role=menuitem], [role=tab], [role=option]")) play(CLICK);
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
