export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Copyright © {new Date().getFullYear()} AETHER-IT</span>
      <span className="site-footer-divider" aria-hidden="true" />
      <span>
        Developed by Sherwin Armas ·{" "}
        <a href="https://www.scaenterprise.com" target="_blank" rel="noreferrer">
          www.scaenterprise.com
        </a>
      </span>
    </footer>
  );
}