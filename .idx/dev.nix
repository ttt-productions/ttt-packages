# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05";

  # Packages needed for npm package development
  packages = [
    pkgs.nodejs_22        # Node.js 22 (matches TTT/Q-Sports)
    pkgs.git              # Git for version control
    pkgs.zip
    pkgs.unzip
  ];

  # Sets environment variables in the workspace
  env = {
    NPM_CONFIG_PREFIX = "$HOME/.npm-global";
  };
  
  idx = {
    # Extensions for TypeScript package development
    extensions = [
      "dbaeumer.vscode-eslint"          # ESLint
      "esbenp.prettier-vscode"          # Prettier
      "ms-vscode.vscode-typescript-next" # TypeScript
    ];

    # No previews needed for packages
    previews = {
      enable = false;
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Install dependencies for all packages
        npm-install = "npm install";
      };
      
      # Runs when the workspace is (re)started
      onStart = {
        # Optional: you can add build watchers here later if needed
      };
    };
  };
}