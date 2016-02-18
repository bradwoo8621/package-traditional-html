/*
 * grunt-group-javascript
 * https://github/com/ebaotech/grunt-group-javascript
 *
 * Copyright (c) 2015 brad.wu
 * Licensed under the MIT license.
 */

'use strict';
var crypto = require('crypto');
var path = require('path');

module.exports = function(grunt) {
    var mapping = function() {
        var mapping = {};
        var put = function(key, value) {
            mapping[key] = value;
        };
        var get = function(key) {
            return mapping[key];
        }
        return {
            put: put,
            get: get
        }
    };
    var fileMapping = mapping();
    var relativeFileMapping = mapping();
    var allFileTypes = [
        'css',
        'js',
        'jpg', 'png', 'gif', 'jpeg',
        'eot', 'svg', 'ttf', 'woff', 'woff2',
        'map',
        'html'
    ];
    var thirdPartyFileExtensions = allFileTypes.filter(function(type) {
        return type != 'map' && type != 'html';
    });
    var thirdPartyVersions = {
        'bootswatch.paper': '3-3-5',
        'bootstrap': '3-3-5',
        'ie10-viewport-bug-workaround': '3-3-5',
        'nest-parrot': '20151223'
    };
    var hashAlgorithm = 'md5';
    var hashLength = 8;

    var buildCSSRef = function(destFilePath, compiledAbsolutePath) {
        return 'href="' + path.relative(path.dirname(destFilePath), compiledAbsolutePath) + '"';
    };
    var buildJSRef = function(destFilePath, compiledAbsolutePath) {
        return 'src="' + path.relative(path.dirname(destFilePath), compiledAbsolutePath) + '"';
    }
    /**
     * @param relativePath relative path in html
     * @param sourceFilePath source html file path, absolute
     * @param destFilePath dest html file path, absolute
     * @param originalString original string which need to be replaced
     * @param newRefBuilder function to build ref tag attribute
     */
    var replaceRefFileInHTML = function(relativePath, sourceFilePath, destFilePath, originalString, newRefBuilder) {
        // calculate the absolute path of css (root is project)
        var absolutePath = path.resolve(path.dirname(sourceFilePath), relativePath);
        relativeFileMapping.put(relativePath, absolutePath);
        // console.log('CSS Absolute Path: [' + absolutePath + ']');
        var compiledAbsolutePath = fileMapping.get(absolutePath);
        if (compiledAbsolutePath) {
            // found
            var newRelativePath = newRefBuilder(destFilePath, compiledAbsolutePath);
            // deal with the OS file separator
            return newRelativePath.replace(new RegExp('\\' + path.sep, 'g'), '/');
        } else {
            return originalString;
        }
    };

    var addHash = function(dest, src, options) {
        // get qualified file path from cwd and src
        var filePath = options.cwd + src;
        // read file
        var fileContent = grunt.file.read(filePath);
        // calculate hash by file content
        var hash = crypto.createHash(hashAlgorithm)
            .update(fileContent)
            .digest('hex')
            .slice(0, hashLength);
        // build new file name with hash
        var fileNameSegments = src.split('.');
        fileNameSegments.splice(fileNameSegments.length - 1, 1, hash);
        // log hash with qualified file path
        var ext = path.extname(filePath);
        if (ext == '.jsx') {
            ext = '.js';
        }
        fileMapping.put(path.resolve(filePath),
            path.resolve(dest + fileNameSegments.join('-') + '.min' + ext));
        // console.log('Source Path: [' + path.resolve(filePath) + ']');
        // console.log('Middle Path: [' + fileMapping.get(path.resolve(filePath)) + ']');
        // return dest file path
        // use hyphen since cssmin only use the first file name
        return dest + fileNameSegments.join('-') + path.extname(filePath);
    };
    // Project configuration.
    grunt.initConfig({
    	sourcePath: 'test/fixtures',
        targetPath: 'test/target',
        middlePath: 'test/intermediate',
        clean: {
            target: ['<%= targetPath %>'],
            middle: ['<%= middlePath %>']
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1,
                sourceMap: true,
                processImport: false
            },
            'common-css': {
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/css/',
                    src: ['**/*.css'],
                    dest: '<%= middlePath %>/css/',
                    ext: '.min.css',
                }]
            },
            'third-css': {
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/js/third/',
                    src: ['**/*.css'],
                    dest: '<%= middlePath %>/js/third/',
                    ext: '.min.css',
                }]
            }
        },
        copy: {
            'common-css-2-middle': {
                files: [{
                    expand: true,
                    cwd: '<%= sourcePath %>/css/',
                    src: ['**/*.css'],
                    dest: '<%= middlePath %>/css/',
                    rename: function(dest, src, options) {
                        return addHash(dest, src, options);
                    }
                }]
            },
            'common-js-2-middle': {
                files: [{
                    expand: true,
                    cwd: '<%= sourcePath %>/js/common/',
                    src: ['**/*.js', '**/*.jsx', '!entry.jsx'],
                    dest: '<%= middlePath %>/js/common/',
                    rename: function(dest, src, options) {
                        return addHash(dest, src, options);
                    }
                }]
            },
            'third-2-middle': {
                files: [{
                    expand: true,
                    cwd: '<%= sourcePath %>/js/third/',
                    // third party files
                    // exclude min css and js
                    // exclude fonts folder
                    src: ['**/*', '!**/*.min.css', '!**/*.min.js', '!fonts/**/*'],
                    dest: '<%= middlePath %>/js/third/',
                    filter: function(filePath) {
                        return thirdPartyFileExtensions.some(function(ext) {
                            return path.extname(filePath) == ('.' + ext);
                        });
                    },
                    rename: function(dest, src, options) {
                        var file = path.parse(src);
                        var version = thirdPartyVersions[file.name] ? ('-' + thirdPartyVersions[file.name]) : '';
                        var target = null;

                        var sourcePath = options.cwd + src;
                        var key = path.resolve(sourcePath);

                        if (path.extname(src) == '.css' || path.extname(src) == '.js') {
                            target = dest + file.dir + path.sep + file.name.replace('.', '-') + version + file.ext;
                            fileMapping.put(key, dest + file.dir + path.sep + file.name.replace('.', '-') + version + '.min' + file.ext);
                        } else {
                            target = dest + file.dir + path.sep + file.name + version + file.ext;;
                        }
                        return target;
                    }
                }]
            },
            'third-fonts-2-middle': {
                files: [{
                    expand: true,
                    cwd: '<%= sourcePath %>/js/third/fonts/',
                    // third party fonts files
                    src: ['**/*'],
                    dest: '<%= middlePath %>/js/third/fonts/'
                }]
            },
            '2-target': {
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/',
                    src: ['**/*'],
                    dest: '<%= targetPath %>/',
                    filter: function(filePath) {
                        return allFileTypes.some(function(ext) {
                            return path.extname(filePath) == ('.' + ext);
                        });
                    }
                }]
            }
        },
        replace: {
            'common-css-map': {
                options: {
                    patterns: [
                        {
                            match: /("sources":\[")((.*\/)*)(.*css"\])/,
                            replacement: '$1$4'
                        }
                    ]
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/css/',
                    src: ['**/*.min.css.map'],
                    dest: '<%= middlePath %>/css/'
                }]
            },
            'ref-in-html': {
                options: {
                    patterns: [
                        {
                            match: /(href=")(.*\.css)(")/g,
                            replacement: function() {
                                return replaceRefFileInHTML(arguments[2], arguments[6], arguments[7], arguments[0], buildCSSRef);
                            }
                        },
                        {
                            match: /(src=")(.*\.jsx?)(")/g,
                            replacement: function() {
                                return replaceRefFileInHTML(arguments[2], arguments[6], arguments[7], arguments[0], buildJSRef)
                            }
                        }
                    ]
                },
                files: [{
                    expand: true,
                    cwd: '<%= sourcePath %>/',
                    src: ['**/*.html'],
                    dest: '<%= middlePath %>/'
                }]
            },
            'third-css-map': {
                options: {
                    patterns: [
                        {
                            match: /("sources":\[")((.*\/)*)(.*css"\])/,
                            replacement: '$1$4'
                        }
                    ]
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/js/third/',
                    src: ['**/*.min.css.map'],
                    dest: '<%= middlePath %>/js/third/'
                }]
            },
            'project-js': {
                options: {
                    patterns: [
                        {
                            match: /<!-- Project javascripts starts here -->[\s\S]*<!-- Project javascripts ends here -->/g,
                            replacement: function() {
                                // for (var index = 0, count = arguments.length; index < count; index++) {
                                //     console.log('Arguments Index: ' + index);
                                //     if (typeof arguments[index] === 'string') {
                                //         console.log(arguments[index].replace(/</g, '&lt;'));
                                //     } else {
                                //         console.log(arguments[index]);
                                //     }
                                // }
                                // find javascript files in matched block
                                var matched = arguments[0];
                                var lines = matched.split(/\r|\n|\r\n/);
                                var srcPattern = /(src=['|"]{1})(.*\.jsx?)(['|"]{1})/;
                                var scriptFiles = lines.map(function(line) {
                                    var match = srcPattern.exec(line);
                                    if (match != null) {
                                        var scriptAbsoluteFilePath = relativeFileMapping.get(match[2]);
                                        if (!grunt.file.exists(scriptAbsoluteFilePath)) {
                                            grunt.log.error('Javascript file "' + scriptFilePath + '" not found.');
                                            return {
                                                relative: match[2]
                                            };
                                        } else {
                                            // console.log(scriptAbsoluteFilePath);
                                            return {
                                                absolute: scriptAbsoluteFilePath,
                                                relative: match[2]
                                            };
                                        }
                                    } else {
                                        return null;
                                    }
                                });
                                var newScriptContent = scriptFiles.filter(function(file) {
                                    return file != null;
                                }).map(function(file) {
                                    if (file.absolute) {
                                        var content = grunt.file.read(file.absolute);
                                        return '/* #INFO: Merged from [' + file.relative + ']. */\r' + content;
                                    } else {
                                        return '/* #WARN: Should be merged from [' + file.relative + '], but the file missed. */\r';
                                    }
                                }).join('\r');
                                var hash = crypto.createHash(hashAlgorithm)
                                    .update(newScriptContent)
                                    .digest('hex')
                                    .slice(0, hashLength);
                                var targetHTMLFile = path.parse(arguments[4]);
                                var targetFileAbsolutePath = path.resolve(arguments[4]);
                                var newScriptFileName = targetHTMLFile.name + '-bundle-' + hash + '.jsx';
                                grunt.file.write(path.dirname(targetFileAbsolutePath) + path.sep + newScriptFileName, newScriptContent);
                                return '<script src="' + newScriptFileName.replace('.jsx', '.min.js') + '"></script>';
                            }
                        }
                    ]
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/',
                    src: ['**/*.html'],
                    dest: '<%= middlePath %>/'
                }]
            }
        },
        uglify: {
            'third-js': {
                options: {
                    sourceMap: true
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/js/third/',
                    src: ['**/*.js'],
                    dest: '<%= middlePath %>/js/third/',
                    ext: '.min.js',
                }]
            },
            'common-js': {
                options: {
                    sourceMap: true
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/js/common/',
                    src: ['**/*.js'],
                    dest: '<%= middlePath %>/js/common/',
                    ext: '.min.js',
                }]
            },
            'project-js': {
                options: {
                    sourceMap: true
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/',
                    src: [
                        '**/*.js',
                        '!js/**/*.*'
                    ],
                    dest: '<%= middlePath %>/',
                    ext: '.min.js',
                }]
            }
        },
        babel: {
            'common-js': {
                options: {
                    "presets": ["react"],
                    "plugins": ["transform-react-jsx"]
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/js/common/',
                    src: ['**/*.jsx', '**/*.js'],
                    dest: '<%= middlePath %>/js/common/',
                    ext: '.js'
                }]
            },
            'project-js': {
                options: {
                    "presets": ["react"],
                    "plugins": ["transform-react-jsx"]
                },
                files: [{
                    expand: true,
                    cwd: '<%= middlePath %>/',
                    src: [
                        '**/*.jsx',
                        '!js/**/*.*'
                    ],
                    dest: '<%= middlePath %>/',
                    ext: '.js'
                }]
            }
        },
        jshint: {
            options: {
                eqnull: true,
                "-W041": false, // disable the check "use === to compare with 0"
                scripturl: true, //disable the check "Script URL"
                // more options here if you want to override JSHint
                // defaults
                globals: {
                    jQuery: true,
                    console: true,
                    module: true
                }
            },
            'common-js': {
                files: {
                    src: [
                        '<%= middlePath %>/js/common/**/*.js',
                        '!<%= middlePath %>/js/common/**/*.min.js'
                    ]
                }
            },
            'project-js': {
                files: {
                    src: [
                        '<%= middlePath %>/**/*.js',
                        '!<%= middlePath %>/**/*.min.js',
                        '!<%= middlePath %>/js/**/*.*'
                    ]
                }
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-replace');

    grunt.registerTask('clean-all', ['clean:target', 'clean:middle']);
    grunt.registerTask('common-css', [
        'copy:common-css-2-middle',     // copy to intermediate folder, add hash value into file name
        'cssmin:common-css',    // minify css file, create map file
        'replace:common-css-map'   // replace source file path in map file, bug of cssmin
    ]);
    grunt.registerTask('common-js', [
        'copy:common-js-2-middle',   // copy to intermediate folder, add hash value into file name
        'babel:common-js',       // compile jsx to js
        'uglify:common-js'          // minify common js files, create map files
    ]);
    grunt.registerTask('third', [
        'copy:third-2-middle',      // copy to intermediate folder, add version into file name
        'cssmin:third-css',     // minify third-party css files, create map files
        'replace:third-css-map',    // replace source file path in map file, bug of cssmin
        'uglify:third-js',      // minify third-party js files, create map files
        'copy:third-fonts-2-middle'     // copy third-party fonts files
    ]);
    grunt.registerTask('html', [
        'replace:ref-in-html',        // replace css and js tag in html
        'replace:project-js',        // group and replace project js files
        'babel:project-js',          // compile project jsx to js
        'uglify:project-js'         // minify project js files, create map files
    ]);
    grunt.registerTask('hint', [
        'jshint:common-js',
        'jshint:project-js'
    ]);
    grunt.registerTask('final', ['copy:2-target', 'clean:middle']);
    grunt.registerTask('test', [
        'clean-all',
        'common-css',
        'common-js',
        'third',
        'html',
        'hint',
        'final'
    ]);
};
