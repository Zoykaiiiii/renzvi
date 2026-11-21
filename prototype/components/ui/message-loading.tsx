"use client";

import { useId } from "react";

function MessageLoading() {
  const id = useId();
  const first = `spinner-first-${id}`;
  const last = `spinner-last-${id}`;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="text-foreground motion-reduce:[&>circle]:[cy:12px]!"
    >
      <circle cx="4" cy="12" r="2" fill="currentColor">
        <animate
          id={first}
          begin={`0s;${last}.end+0.25s`}
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
      <circle cx="12" cy="12" r="2" fill="currentColor">
        <animate
          begin={`${first}.begin+0.1s`}
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
      <circle cx="20" cy="12" r="2" fill="currentColor">
        <animate
          id={last}
          begin={`${first}.begin+0.2s`}
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
    </svg>
  );
}

export { MessageLoading };
