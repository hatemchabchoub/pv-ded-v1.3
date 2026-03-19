const PlaceholderPage = ({ title, description }: { title: string; description: string }) => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
    <div className="surface-elevated p-8 mt-6 text-center text-sm text-muted-foreground">
      الوحدة قيد التطوير
    </div>
  </div>
);

export const UsersPage = () => <PlaceholderPage title="المستخدمون" description="إدارة الحسابات والأدوار" />;
