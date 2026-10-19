type SectionTitleProps = {
  title: string;
  description?: string;
};

export function SectionTitle({ title, description }: SectionTitleProps) {
  return (
    <div className="mb-10 max-w-3xl sm:mb-14">
      <h2 className="section-title">{title}</h2>
      {description && <p className="section-description mt-5 max-w-2xl text-base leading-8 sm:text-lg">{description}</p>}
    </div>
  );
}
