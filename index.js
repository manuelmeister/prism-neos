(function (Prism) {

    Prism.languages.eel = Prism.util.clone(Prism.languages.javascript)
    Prism.languages.eel.keyword = [...Prism.languages.javascript.keyword, /\b(?:documentNode|node|site|value|request|props)\b/]


    const javascript = Prism.util.clone(Prism.languages.javascript);
    javascript['constant'] = [/\b(?:documentNode|node|request)\b/, /\b[A-Z](?:[A-Z_]|\dx?)*\b/]

    const space = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source;
    const braces = /(?:\{?(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*?\})/.source;
    let spread = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;

    /**
     * @param {string} source
     * @param {string} [flags]
     */
    function re(source, flags) {
        source = source
            .replace(/<S>/g, function () {
                return space;
            })
            .replace(/<BRACES>/g, function () {
                return braces;
            })
            .replace(/<SPREAD>/g, function () {
                return spread;
            });
        return RegExp(source, flags);
    }

    spread = re(spread).source;

    // AFX
    Prism.languages.afx = Prism.languages.extend('markup', javascript);
    Prism.languages.afx.tag.pattern = re(
        /<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$@-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/.source
    );
    Prism.languages.afx.comment = Prism.languages.html.comment
    Prism.languages.afx.tag.inside['tag'].pattern = /^<\/?[^\s>\/]*/;
    Prism.languages.afx.tag.inside['attr-name'].inside = {
        atrule: {
            pattern: /\@\w+/,
            greedy: true
        },
        selector: {
            pattern: /(?<=\@\w+\.)\w+/,
            greedy: true
        }
    };
    Prism.languages.afx.tag.inside['attr-value'].pattern = /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/;
    Prism.languages.afx.tag.inside['attr-value'].inside = {
        function: /}|{/,
        eel: {
            pattern: re(/(?<==)<BRACES>/.source),
        },
    }
    Prism.languages.afx.tag.inside['tag'].inside['class-name'] = /^[A-Z]\w*(?:\.:[A-Z]\w*)*$/;
    Prism.languages.afx.tag.inside['comment'] = javascript['comment'];

    Prism.languages.insertBefore('inside', 'attr-name', {
        'spread': {
            pattern: re(/<SPREAD>/.source),
            inside: Prism.languages.eel
        }
    }, Prism.languages.afx.tag);

    Prism.languages.insertBefore('afx', 'tag', {
        'eel': {
            pattern: /\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\}/g,
            greedy: true,
            lookbehind: true,
            inside: {
                'function': {
                    pattern: /}|{/
                },
                'eel': {
                    pattern: /(?<=\{).*(?=})/g,
                    greedy: true,
                    lookbehind: true,
                    inside: Prism.languages.eel
                },
            }
        }
    }, Prism.languages);

    Prism.languages.insertBefore('inside', 'special-attr', {
        'script': {
            // Allow for two levels of nesting
            pattern: re(/(?<==)<BRACES>/.source),
            inside: {
                'function': {
                    pattern: /}|{/,
                    greedy: true,
                    lookbehind: true
                },
                'script-punctuation': {
                    pattern: /^=(?=\{)/,
                    alias: 'punctuation'
                },
                'eel': {
                    pattern: /(?<=\{).*(?=})/g,
                    greedy: true,
                    lookbehind: true,
                    inside: Prism.languages.eel
                },
            },
        },
    }, Prism.languages.afx.tag);


    // The following will handle plain text inside tags
    function stringifyToken(token) {
        if (!token) {
            return '';
        }
        if (typeof token === 'string') {
            return token;
        }
        if (typeof token.content === 'string') {
            return token.content;
        }
        return token.content.map(stringifyToken).join('');
    }

    function walkTokens(tokens) {
        var openedTags = [];
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var notTagNorBrace = false;

            if (typeof token !== 'string') {
                if (token.type === 'tag' && token.content[0] && token.content[0].type === 'tag') {
                    // We found a tag, now find its kind

                    if (token.content[0].content[0].content === '</') {
                        // Closing tag
                        if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
                            // Pop matching opening tag
                            openedTags.pop();
                        }
                    } else {
                        if (token.content[token.content.length - 1].content === '/>') {
                            // Autoclosed tag, ignore
                        } else {
                            // Opening tag
                            openedTags.push({
                                tagName: stringifyToken(token.content[0].content[1]),
                                openedBraces: 0
                            });
                        }
                    }
                } else if (openedTags.length > 0 && token.type === 'punctuation' && token.content === '{') {
                    // Here we might have entered a JSX context inside a tag
                    openedTags[openedTags.length - 1].openedBraces++;

                } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === 'punctuation' && token.content === '}') {

                    // Here we might have left a JSX context inside a tag
                    openedTags[openedTags.length - 1].openedBraces--;

                } else {
                    notTagNorBrace = true;
                }
            }
            if (notTagNorBrace || typeof token === 'string') {
                if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
                    // Here we are inside a tag, and not inside a JSX context.
                    // That's plain text: drop any tokens matched.
                    var plainText = stringifyToken(token);

                    // And merge text with adjacent text
                    if (i < tokens.length - 1 && (typeof tokens[i + 1] === 'string' || tokens[i + 1].type === 'plain-text')) {
                        plainText += stringifyToken(tokens[i + 1]);
                        tokens.splice(i + 1, 1);
                    }
                    if (i > 0 && (typeof tokens[i - 1] === 'string' || tokens[i - 1].type === 'plain-text')) {
                        plainText = stringifyToken(tokens[i - 1]) + plainText;
                        tokens.splice(i - 1, 1);
                        i--;
                    }

                    tokens[i] = new Prism.Token('plain-text', plainText, null, plainText);
                }
            }

            if (token.content && typeof token.content !== 'string') {
                walkTokens(token.content);
            }
        }
    }

    Prism.hooks.add('after-tokenize', function (env) {
        if (env.language !== 'jsx' && env.language !== 'afx' && env.language !== 'tsx') {
            return;
        }
        walkTokens(env.tokens);
    });

    /**
     * Original by Aaron Harun: http://aahacreative.com/2012/07/31/php-syntax-highlighting-prism/
     * Modified by Miles Johnson: http://milesj.me
     * Rewritten by Tom Pavelec
     * Modified by Manuel Meister: https://meister.io
     *
     * Supports Neos Fusion
     */
    Prism.languages.neosfusion = {
        'eel': {
            alias: 'punctuation',
            pattern: /\$\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*?\}/s,
            greedy: true,
            inside: {
                'function': {
                    pattern: /\$\{(?=.*?})|(?<=\$\{.*?)}/s,
                    greedy: true
                },
                'eel': {
                    pattern: /(?<=\$\{).*?(?=})/s,
                    greedy: true,
                    inside: Prism.languages.eel
                }
            }
        },
        'atrule': {
            pattern: /@\w+\b(\.\w*)?/,
            greedy: true,
            inside: {
                'punctuation': /\./,
                'attr-value': {
                    pattern: /(?<=\.)\w+/,
                    greedy: true,
                    lookbehind: true
                }
            }
        },
        'constant': [
            /\b(?:null)\b/i,
            /\b[A-Z_][A-Z0-9_]*\b(?!\s*\()/
        ],
        'boolean': {
            pattern: /\b(?:false|true)\b/i,
        },
        'dsl': {
            pattern: /\b[a-zA-Z]+`(?:\\[\s\S]|[^\\`])*`/m,
            alias: 'string',
            lookbehind: true,
            greedy: true,
            inside: {
                'symbol': /\b[a-zA-Z]+(?=`)/,
                'afx': {
                    pattern: /(?<=afx`)(?:\\[\s\S]|[^\\`])*(?=`)/m,
                    greedy: true,
                    inside: Prism.languages.afx
                }
            }
        },
        'string': [
            {
                pattern: /`.*?(?<!\\)`/,
                alias: 'backtick-quoted-string',
                greedy: true
            },
            {
                pattern: /'.*?(?<!\\)'/,
                alias: 'single-quoted-string',
                lookbehind: true,
                greedy: true
            },
            {
                pattern: /".*?(?<!\\)"/,
                alias: 'double-quoted-string',
                greedy: true
            }
        ],
        'comment': [
            {
                pattern: /(?:\/\/|#).*$/m,
                greedy: true
            },
            {
                pattern: /^(?!.*include:).*\/\*[\s\S]*?\*\//gm,
                greedy: true
            }
        ],
        'package': {
            pattern: /(namespace\s+|use\s+(?:function\s+)?)(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
            lookbehind: true,
            inside: {
                'punctuation': /\\/
            }
        },
        'include-statement': {
            pattern: /^\s*(include:.*)$/m,
            alias: 'url',
            greedy: true,
            inside: {
                'punctuation': {
                    pattern: /(include):/,
                    lookbehind: true,
                },
                'keyword': {
                    pattern: /include/i,
                }
            }
        },
        'keyword': [
            {
                pattern: /\brenderer\b/i,
                alias: 'type-hint',
                greedy: true,
                lookbehind: true
            }
        ],
        'class-name': [
            {
                pattern: /\b[-.:@"'\w]+:[-.:@"'\w]+/i,
                alias: ['class-name-fully-qualified', 'static-context'],
                greedy: true,
                inside: {
                    'namespace': /\b[-.:@"'\w]+(?=:[-.:@"'\w]+)/,
                    'punctuation': /:/
                }
            },
        ],
        'function': {
            pattern: /(^|[^\\\w])\\?[a-z_](?:[\w\\]*\w)?(?=\s*\()/i,
            lookbehind: true,
            inside: {
                'punctuation': /\\/
            }
        },
        'number': /(?:\b\d+(?:_\d+)*\.?(?:\d+(?:_\d+)*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
        'operator': /<?=>|\?\?=?|\.{3}|\??->|[!=]=?=?|::|\*\*=?|--|\+\+|&&|\|\||<<|>>|[?~]|[/^|%*&<>+-]=?/,
        'punctuation': /[{}\[\](),:;]/
    };

}(Prism));
