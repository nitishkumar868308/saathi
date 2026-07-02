// CSS imports ke liye type declarations (template ke web/global CSS files ke liye)
declare module "*.css";
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
