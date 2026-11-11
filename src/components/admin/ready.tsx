import { ScanFace } from "lucide-react";

/**
 * Splash screen displayed when no resources are configured yet.
 *
 * Automatically shown when the admin app has no Resource children defined.
 */
export const Ready = () => (
  <div className="flex flex-col h-screen">
    <div
      className="flex-1 flex flex-col text-white text-center justify-center items-center"
      style={{
        background:
          "linear-gradient(135deg, #00023b 0%, #00023b 50%, #313264 100%)",
      }}
    >
      <ScanFace className="w-32 h-32 mb-4" />
      <h1 className="text-3xl mb-4">Escencial</h1>
      <div className="text-lg opacity-75">
        Your application is properly configured.
        <br />
        Now you can add a &lt;Resource&gt; as child of
        &lt;Admin&gt;&lt;/Admin&gt;
      </div>
    </div>
  </div>
);
