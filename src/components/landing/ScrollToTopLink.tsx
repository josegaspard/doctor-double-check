import { Link, LinkProps } from 'react-router-dom';

interface ScrollToTopLinkProps extends LinkProps {
  children: React.ReactNode;
}

export function ScrollToTopLink({ to, children, ...props }: ScrollToTopLinkProps) {
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <Link to={to} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
