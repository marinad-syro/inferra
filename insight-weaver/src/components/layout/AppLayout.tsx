import { ReactNode } from "react";
interface AppLayoutProps {
  leftSidebar: ReactNode;
  mainContent: ReactNode;
  topBar?: ReactNode;
}
const AppLayout = ({
  leftSidebar,
  mainContent,
  topBar,
}: AppLayoutProps) => {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      {/* Top Bar - Canvas Navigator */}
      {topBar && <div className="flex-shrink-0">{topBar}</div>}

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Workflow */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-card">
          {leftSidebar}
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 overflow-auto bg-surface-sunken">
          {mainContent}
        </main>

        {/* Right Sidebar - AI Assistant */}

      </div>
    </div>
  );
};
export default AppLayout;