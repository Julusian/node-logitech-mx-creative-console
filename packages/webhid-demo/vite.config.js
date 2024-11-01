import { defineConfig } from 'vite'
// import reactPlugin from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
	publicDir: 'public',
	// This changes the out put dir from dist to build
	// comment this out if that isn't relevant for your project
	build: {
		outDir: 'dist',
		chunkSizeWarningLimit: 1 * 1000 * 1000, // Disable warning about large chunks
	},
	server: {
		proxy: {},
	},
	plugins: [
		// reactPlugin()
	],
	define: {
		LIB_VERSION: JSON.stringify(process.env.npm_package_version || ''),
	},
	// css: {
	// 	preprocessorOptions: {
	// 		scss: {
	// 			api: 'modern-compiler',
	// 			quietDeps: true,
	// 		},
	// 	},
	// },
})
