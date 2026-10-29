// The paper card shell used across the app: hairline ring, soft shadow, 8px radius.
export function Card({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: { children: React.ReactNode; className?: string; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`ui-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
