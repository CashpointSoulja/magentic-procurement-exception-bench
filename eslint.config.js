import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'video'] },
  ...tseslint.configs.recommended,
  { plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
);
