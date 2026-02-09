import { ReactNode } from "react";
interface AppLayoutProps {
  leftSidebar: ReactNode;
  mainContent: ReactNode;
}
const AppLayout = ({
  leftSidebar,
  mainContent,
}: AppLayoutProps) => {
  return <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar - Workflow */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card">
        {leftSidebar}
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 overflow-auto bg-surface-sunken">
        {mainContent}
      </main>

      {/* Right Sidebar - AI Assistant */}
      
    </div>;
};
export default AppLayout;