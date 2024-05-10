import { expo_config_generate, upload_all_expo_assets } from "./expo";

type APP_TYPE = "expo" | "react-native";

export const get_app_type = async (): Promise<APP_TYPE> => {
  // TODO: implement get_app_type
  return "expo";
};

export const extract_app_config = (app_type: APP_TYPE, root_dir: string) => {
  if (app_type === "expo") {
    return expo_config_generate(root_dir);
  } else {
    // TODO: implement react-native config_extract
    throw new Error("not implemented");
  }
};

export const upload_all_assets = async (
  app_type: APP_TYPE,
  otago_api_key: string,
  project_ref: string,
  root_dir: string,
) => {
  if (app_type === "expo") {
    return upload_all_expo_assets({ otago_api_key, project_ref, root_dir });
  } else {
    // TODO: implement react-native upload_all_assets
    throw new Error("not implemented");
  }
};

export const get_app_manifest = ({
  id,
  asset_uploaded,
  runtimeVersion,
  extra,
}: {
  id: string;
  asset_uploaded: NonNullable<Awaited<ReturnType<typeof upload_all_assets>>["android"]>;
  runtimeVersion: string;
  extra: Record<string, any>;
}) => {
  return {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: asset_uploaded.bundle,
    assets: asset_uploaded.assets,
    extra,
    metadata: {},
  };
};
