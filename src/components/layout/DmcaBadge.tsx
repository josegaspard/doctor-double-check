/**
 * Sello "Protected by DMCA" (DMCA.com).
 *
 * El ID es único por sitio: va tanto en el enlace de estado como en la imagen
 * del badge. Es el item REGISTRADO y VERIFICADO en la cuenta DMCA.com de Jose
 * para medical-masters.com (Protection level 1, plan gratis con 1 takedown/año).
 * Página del certificado: dmca.com/Protection/Status.aspx?ID=<este GUID>.
 * Para cambiarlo basta con reemplazar este GUID por el del snippet oficial.
 *
 * NOTA DE SEGURIDAD (CSP): el embed oficial incluye además el script
 * `DMCABadgeHelper.min.js` desde images.dmca.com. NO se carga a propósito: la
 * CSP de esta plataforma médica (vercel.json) mantiene `script-src` cerrado y
 * no conviene meter un script de terceros en una app con datos clínicos/pagos.
 * El sello no lo necesita: la imagen carga por `img-src https:` y el clic abre
 * el certificado de DMCA en una pestaña nueva (navegación top-level, sin CSP).
 * Si algún día se quiere el popup de verificación, hay que añadir
 * `https://images.dmca.com` a `script-src` en vercel.json e inyectar el script.
 */
const DMCA_BADGE_ID = 'c5e7327d-945f-44eb-aa9d-c86225f899e0';

const STATUS_URL = `https://www.dmca.com/Protection/Status.aspx?ID=${DMCA_BADGE_ID}&refurl=https://medical-masters.com/`;
const BADGE_IMG = `https://images.dmca.com/Badges/dmca_protected_sml_120n.png?ID=${DMCA_BADGE_ID}`;

interface Props {
  className?: string;
}

export function DmcaBadge({ className = '' }: Props) {
  return (
    <a
      href={STATUS_URL}
      title="DMCA.com Protection Status"
      className={`dmca-badge inline-flex items-center rounded-md bg-white/95 px-2 py-1 shadow-sm transition-colors hover:bg-white ${className}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        src={BADGE_IMG}
        alt="DMCA.com Protection Status"
        className="block h-5 w-auto sm:h-6"
        loading="lazy"
      />
    </a>
  );
}

export default DmcaBadge;
