import styles from "./animated-sphere.module.css";

/**
 * The login page's animated orb: a lit, glossy, translucent 3D glass sphere on
 * a near-black, blue-bloomed backdrop. Built entirely from stacked <div>s and
 * the CSS in animated-sphere.module.css — no canvas, no WebGL, no library (a
 * server component that ships no JS).
 *
 * The 3D read is fixed lighting (specular highlight + edge darkening) over a
 * translucent body gradient, with a soft texture rotating underneath so the
 * ball looks like it's turning. It stays perfectly round; only the surface and
 * glow move.
 */
export function AnimatedSphere() {
  return (
    <div className={styles.stage}>
      <div className={styles.halo} aria-hidden="true" />

      <div className={styles.orb} aria-hidden="true">
        {/* Ribbons behind the glass reflection. */}
        <div className={`${styles.ribbon} ${styles.ribbonA}`} />
        <div className={`${styles.ribbon} ${styles.ribbonB}`} />
        <div className={styles.flow} />
        {/* Glass reflection. */}
        <div className={styles.shade} />
        {/* A ribbon passing in front of the reflection. */}
        <div className={`${styles.ribbon} ${styles.ribbonC}`} />
        <div className={styles.bloom} />
        <div className={styles.rim} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-14 p-10 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          <span className="font-bold">Connect</span>
          <span className="font-light">Sphere</span>
        </p>
        <p className="mt-2 text-lg font-light text-foreground/80">
          Event planning &amp; venue booking
        </p>
      </div>
    </div>
  );
}
