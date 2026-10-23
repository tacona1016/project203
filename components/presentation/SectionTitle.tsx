type SectionTitleProps = {
  title: string;
  description?: string;
  as?: "h1" | "h2";
};

export function SectionTitle({ title, description, as: Heading = "h2" }: SectionTitleProps) {
  return (
    <div className="mb-10 max-w-3xl sm:mb-14">
      <Heading className="section-title">{title}</Heading>
      {description && <p className="section-description mt-5 max-w-2xl text-base leading-8 sm:text-lg">{description}</p>}
    </div>
  );
}
