import { ScrollToTopLink } from './ScrollToTopLink';
import logoWhite from '@/assets/logo-medical-masters-white.png';

export function LandingFooter() {
  return (
    <footer className="bg-[#0b1d45] pt-12 sm:pt-20 pb-8 sm:pb-10 text-slate-300 border-t border-white/5 font-light text-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-10 mb-10 sm:mb-16">
          {/* Brand Column */}
          <div className="col-span-2">
            <img src={logoWhite} alt="Medical Logo" className="h-8 mb-4 sm:mb-6 opacity-90" />
            <p className="mb-4 sm:mb-6 max-w-sm text-slate-400 text-xs sm:text-sm">
              Revolucionando la atención médica a través de la tecnología. Comprometidos con la ética, la seguridad y la excelencia clínica.
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors">
                <i className="fa-brands fa-linkedin-in text-sm" />
              </a>
              <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors">
                <i className="fa-brands fa-twitter text-sm" />
              </a>
              <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors">
                <i className="fa-brands fa-instagram text-sm" />
              </a>
            </div>
          </div>

          {/* Links - Plataforma */}
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">Plataforma</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              <li><ScrollToTopLink to="/for-doctors" className="hover:text-[#aed3d9] transition-colors">Para Médicos</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/for-patients" className="hover:text-[#aed3d9] transition-colors">Para Pacientes</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/enterprise" className="hover:text-[#aed3d9] transition-colors">Enterprise</ScrollToTopLink></li>
            </ul>
          </div>

          {/* Links - Recursos */}
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">Recursos</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              <li><ScrollToTopLink to="/success-stories" className="hover:text-[#aed3d9] transition-colors">Casos de Éxito</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/help" className="hover:text-[#aed3d9] transition-colors">Ayuda</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/contact" className="hover:text-[#aed3d9] transition-colors">Contacto</ScrollToTopLink></li>
            </ul>
          </div>

          {/* Links - Legal */}
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">Legal</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              <li><ScrollToTopLink to="/privacy" className="hover:text-[#aed3d9] transition-colors">Privacidad</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/terms" className="hover:text-[#aed3d9] transition-colors">Términos</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/security" className="hover:text-[#aed3d9] transition-colors">Seguridad</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/compliance" className="hover:text-[#aed3d9] transition-colors">Compliance</ScrollToTopLink></li>
              <li><ScrollToTopLink to="/report-issue" className="hover:text-[#aed3d9] transition-colors text-orange-300/80 hover:text-orange-200">Reportar falla o abuso</ScrollToTopLink></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm text-center sm:text-left">&copy; 2026 Medical Platform Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500 font-bold text-xs">All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    </footer>
  );
}
