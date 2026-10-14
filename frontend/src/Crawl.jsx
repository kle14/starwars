import { useEffect } from "react";

export default function Crawl({ stats, onDone }) {
  const top = stats?.top_users?.[0];

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" || e.key === "Enter") onDone(); };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [onDone]);

  return (
    <div className="crawl-wrap">
      <p className="far-away">
        A long time ago, in a server room far, far away....
      </p>

      <h1 className="crawl-logo">HOLONET</h1>

      <div className="crawl-stage">
        <div className="crawl"
             onAnimationEnd={(e) => e.target === e.currentTarget && onDone()}>
          <h2>EPISODE IV½</h2>
          <h2 className="sub">THE LOGS STRIKE BACK</h2>

          <p>
            It is a time of silent conflict. Across {stats?.conversations ?? "many"} secret
            channels, {stats?.users ?? "countless"} operatives of the Rebellion, the Empire,
            the Jedi Order and the Sith have exchanged {stats?.messages ?? "endless"} transmissions.
          </p>
          <p>
            Hidden in the noise lie battle plans, betrayals, and long complaints about
            hyperdrives.
            {top && ` The most talkative operative, ${top.name}, has sent ${top.count} messages alone.`}
          </p>
          <p>
            You, the Holonet administrator, have been granted access to every channel.
            Search the galaxy, intercept transmissions, and decide who can be trusted
            before the next battle begins...
          </p>
        </div>
      </div>

      <button className="skip" onClick={onDone}>Skip ▶</button>
    </div>
  );
}
